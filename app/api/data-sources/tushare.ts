import { DataSourceResult, UnifiedAsset } from "./types";
import { fetchWithTimeout } from "./_untils";

async function fetchTushare(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
  
  console.log(`[fetchTushare] 发起请求: ${url}`);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    console.log(`[fetchTushare] 请求成功，状态码: ${response.status}`);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error(`[fetchTushare] 请求失败:`, error);
    // 区分超时错误和其他错误
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`请求超时 (10000ms)`);
    }
    throw error; // 重新抛出其他错误
  }
}

/**
 * 专门用于查询场外基金信息的函数
 * @param symbol 基金代码，如 "017174"、"000001" 等
 * @returns 统一格式的基金数据
 */
export async function queryTushareFund(symbol: string): Promise<DataSourceResult> {
  console.log(`\n=== [Tushare基金] 开始处理基金查询: ${symbol} ===`);
  const TUSHARE_KEY = process.env.TUSHARE_KEY;
  
  if (!TUSHARE_KEY) {
    console.error(`[Tushare基金] 错误: API Key未配置`);
    return { 
      success: false, 
      data: null, 
      error: 'Tushare API Key未配置', 
      source: 'Tushare基金' 
    };
  }

  try {
    const url = `https://api.tushare.pro`;
    
    // 第一步：尝试多种可能的基金代码格式进行查询
    let fundCode = symbol.trim();
    
    // 尝试添加 .OF 后缀（开放式基金常见格式）
    if (!fundCode.includes('.')) {
      fundCode = `${fundCode}.OF`;
    }
    
    console.log(`[Tushare基金] 使用基金代码格式: ${fundCode}`);
    console.log(`[Tushare基金] 调用fund_basic接口`);
    
    // 调用Tushare的fund_basic接口获取基金基本信息
    const basicResponse = await fetchTushare(url, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ 
        token: TUSHARE_KEY,
        api_name: 'fund_basic', 
        params: { ts_code: fundCode }, 
        fields: 'ts_code,name,management,found_date,fund_type,market' 
      })
    });
    
    const basicData = await basicResponse.json();
    console.log(`[Tushare基金] fund_basic接口返回:`, JSON.stringify(basicData, null, 2));

    // 检查接口返回状态
    if (basicData.code !== 0) {
      console.error(`[Tushare基金] fund_basic接口调用失败: ${basicData.msg}`);
      return { 
        success: false, 
        data: null, 
        error: `基金查询失败: ${basicData.msg}`, 
        source: 'Tushare基金' 
      };
    }

    // 检查是否有数据返回
    if (!basicData.data?.items || basicData.data.items.length === 0) {
      console.warn(`[Tushare基金] 未找到基金代码: ${fundCode}`);
      
      // 尝试去掉后缀再查询一次
      const cleanCode = symbol.trim();
      if (cleanCode !== fundCode) {
        console.log(`[Tushare基金] 尝试查询原始代码: ${cleanCode}`);
        
        const retryResponse = await fetchTushare(url, { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ 
            token: TUSHARE_KEY,
            api_name: 'fund_basic', 
            params: { ts_code: cleanCode }, 
            fields: 'ts_code,name,management,found_date,fund_type,market' 
          })
        });
        
        const retryData = await retryResponse.json();
        
        if (retryData.code === 0 && retryData.data?.items?.length > 0) {
          console.log(`[Tushare基金] 使用原始代码查询成功`);
          return await processFundData(retryData, cleanCode, TUSHARE_KEY);
        }
      }
      
      return { 
        success: false, 
        data: null, 
        error: `未找到基金代码 "${symbol}"`, 
        source: 'Tushare基金' 
      };
    }

    return await processFundData(basicData, fundCode, TUSHARE_KEY);

  } catch (error: any) {
    console.error(`\n=== [Tushare基金] 查询异常 ===`, error);
    return { 
      success: false, 
      data: null, 
      error: `基金查询失败: ${error.message}`, 
      source: 'Tushare基金' 
    };
  }
}

/**
 * 处理基金数据并获取净值信息
 */
async function processFundData(basicData: any, fundCode: string, tushareKey: string): Promise<DataSourceResult> {
  try {
    const fund = basicData.data.items[0];
    console.log(`[Tushare基金] 获取到基金信息: ${fund.name} (${fund.ts_code})`);
    
    // 第二步：获取基金最新净值数据
    console.log(`[Tushare基金] 调用fund_nav接口获取净值`);
    const url = `https://api.tushare.pro`;
    
    // 获取最近30天的净值数据，取最新的
    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    
    const navResponse = await fetchTushare(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: tushareKey,
        api_name: 'fund_nav',
        params: { 
          ts_code: fundCode,
          start_date: startDate,
          end_date: endDate
        },
        fields: 'nav_date,unit_nav,accum_nav,daily_return'
      })
    });
    
    const navData = await navResponse.json();
    console.log(`[Tushare基金] fund_nav接口返回:`, JSON.stringify(navData, null, 2));
    
    let price = 0;
    let changePercent = 0;
    let lastUpdated = new Date().toISOString();
    
    if (navData.code === 0 && navData.data?.items && navData.data.items.length > 0) {
      // 取最新的净值数据（按日期排序）
      const latestNav = navData.data.items[0];
      price = latestNav.unit_nav || latestNav.accum_nav || 0;
      changePercent = latestNav.daily_return || 0;
      lastUpdated = latestNav.nav_date ? 
        `${latestNav.nav_date}T15:00:00.000Z` : lastUpdated;
      
      console.log(`[Tushare基金] 最新净值: ${price}, 日增长率: ${changePercent}%`);
    } else {
      console.warn(`[Tushare基金] 未获取到净值数据，使用默认值`);
      // 如果没有净值数据，可以尝试其他接口或设置默认值
    }
    
    // 第三步：组装返回数据
    const asset: UnifiedAsset = {
      symbol: fund.ts_code,
      name: fund.name,
      price: price,
      changePercent: changePercent,
      currency: 'CNY',
      market: fund.market || '中国场外基金市场',
      type: 'fund', // 类型设为fund
      source: 'Tushare基金',
      lastUpdated: lastUpdated,
      // 添加基金特有信息
      metadata: {
        management: fund.management, // 基金管理人
        fundType: fund.fund_type,    // 基金类型
        foundDate: fund.found_date   // 成立日期
      }
    };
    
    console.log(`[Tushare基金] 成功组装基金数据:`, JSON.stringify(asset, null, 2));
    console.log(`=== [Tushare基金] 查询处理完成 ===\n`);
    
    return { 
      success: true, 
      data: asset, 
      source: 'Tushare基金' 
    };
    
  } catch (error: any) {
    console.error(`[Tushare基金] 数据处理异常:`, error);
    return { 
      success: false, 
      data: null, 
      error: `基金数据处理失败: ${error.message}`, 
      source: 'Tushare基金' 
    };
  }
}

