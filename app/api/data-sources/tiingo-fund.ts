import { DataSourceResult, UnifiedAsset } from "./types";
import { config } from 'dotenv';
config({ path: '.env.local' });

const TIINGO_TOKEN = process.env.TIINGO_TOKEN;
if (!TIINGO_TOKEN) {
  throw new Error("请在 .env.local 中设置 TIINGO_TOKEN");
}

/**
 * 从 Tiingo 获取基金数据（共同基金/ETF）
 * @param symbol 基金代码，例如 "VTSAX"（不带 .OF 后缀）
 */
export async function queryTiingoFund(symbol: string): Promise<DataSourceResult> {
  console.log(`\n=== [Tiingo] 开始处理基金查询: ${symbol} ===`);

  // 清理代码，移除可能的后缀（.OF, .US 等）
  const cleanSymbol = symbol.replace(/\..+$/, '').toUpperCase();
  console.log(`[Tiingo] 清理后的基金代码: ${cleanSymbol}`);

  try {
    // 1. 获取基金元数据（名称等）
    const metaUrl = `https://api.tiingo.com/tiingo/fundamentals/meta?ticker=${cleanSymbol}&token=${TIINGO_TOKEN}`;
    console.log(`[Tiingo] 请求元数据: ${metaUrl.replace(TIINGO_TOKEN!, 'HIDDEN')}`);

    const metaRes = await fetch(metaUrl);
    if (!metaRes.ok) {
      const errorText = await metaRes.text();
      console.error(`[Tiingo] 元数据请求失败: ${metaRes.status} ${errorText}`);
      return {
        success: false,
        data: null,
        error: `Tiingo 基金元数据获取失败: ${metaRes.status}`,
        source: 'Tiingo'
      };
    }

    const metaData = await metaRes.json();
    if (!metaData || !metaData.ticker) {
      return {
        success: false,
        data: null,
        error: `未找到基金代码 ${cleanSymbol} 的元数据`,
        source: 'Tiingo'
      };
    }

    const fundName = metaData.name || cleanSymbol;

    // 2. 获取最新净值（最近一个交易日）
    const dailyUrl = `https://api.tiingo.com/tiingo/fundamentals/${cleanSymbol}/daily?token=${TIINGO_TOKEN}`;
    console.log(`[Tiingo] 请求日线数据: ${dailyUrl.replace(TIINGO_TOKEN!, 'HIDDEN')}`);

    const dailyRes = await fetch(dailyUrl);
    if (!dailyRes.ok) {
      const errorText = await dailyRes.text();
      console.error(`[Tiingo] 日线数据请求失败: ${dailyRes.status} ${errorText}`);
      return {
        success: false,
        data: null,
        error: `Tiingo 基金日线获取失败: ${dailyRes.status}`,
        source: 'Tiingo'
      };
    }

    const dailyData = await dailyRes.json();
    if (!Array.isArray(dailyData) || dailyData.length === 0) {
      return {
        success: false,
        data: null,
        error: `Tiingo 未返回基金 ${cleanSymbol} 的日线数据`,
        source: 'Tiingo'
      };
    }

    // 最新的数据在数组第一个（Tiingo 默认降序）
    const latest = dailyData[0];
    const prev = dailyData.length > 1 ? dailyData[1] : null;

    // 计算日增长率（相对于前一日）
    let changePercent = 0;
    if (prev && prev.close && latest.close) {
      changePercent = ((latest.close - prev.close) / prev.close) * 100;
    }

    // 格式化日期
    const lastDate = new Date(latest.date).toISOString().split('T')[0];

    const asset: UnifiedAsset = {
      symbol: `${cleanSymbol}.OF`,  // 保持统一后缀
      name: fundName,
      price: latest.close,
      changePercent: changePercent,
      currency: 'USD', // 基金通常为美元，但部分可能为其他，可从 metaData 中获取
      market: 'US Fund Market',
      type: 'fund',
      source: 'Tiingo',
      lastUpdated: new Date(latest.date).toISOString(),
      metadata: {
        rawMeta: metaData,
        rawDaily: dailyData,
      },
    };

    console.log(`[Tiingo] 成功获取基金数据: ${asset.name} ${asset.price}`);
    console.log(`=== [Tiingo] 查询处理完成 ===\n`);

    return { success: true, data: asset, source: 'Tiingo' };
  } catch (error: any) {
    console.error(`\n=== [Tiingo] 查询处理异常 ===`, error);
    return {
      success: false,
      data: null,
      error: `Tiingo 查询失败: ${error.message}`,
      source: 'Tiingo',
    };
  }
}