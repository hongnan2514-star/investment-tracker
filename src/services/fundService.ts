// src/services/fundService.ts
import { fetchFundHistoryFromSina, saveFundHistory, getFundHistory, needsUpdate, getFundInfo, saveFundInfo } from './fundHistoryDB';
import { queryEastMoneyFund } from '@/app/api/data-sources/eastmoney-fund';
import { DataSourceResult, UnifiedAsset } from '@/app/api/data-sources/types';

export interface FundNav {
  code: string;
  date: string;
  nav: number;
  accumNav: number;
  change: number;
}

// 缓存最新净值（内存中）
const navCache = new Map<string, FundNav>();

/**
 * 搜索基金并获取历史数据
 */
export async function searchFund(code: string): Promise<DataSourceResult> {
  const cleanCode = code.replace(/\.OF$/, '');
  console.log(`[基金服务] 开始搜索基金: ${cleanCode}`);

  try {
    const needUpdate = await needsUpdate(cleanCode);
    console.log(`[基金服务] needUpdate = ${needUpdate}`);

    let history: FundNav[] = [];
    let usedSource = '';

    if (needUpdate) {
      console.log(`[基金服务] 需要更新，尝试天天基金...`);

      // 调用天天基金获取实时数据
      const fundData = await queryEastMoneyFund(cleanCode);

      if (fundData) {
        console.log(`[基金服务] 天天基金获取成功`);
        usedSource = 'eastmoney';

        const today = fundData.navDate || new Date().toISOString().split('T')[0];
        const fakeNav: FundNav = {
          code: cleanCode,
          date: today,
          nav: fundData.price,
          accumNav: fundData.price,
          change: fundData.changePercent,
        };
        history = [fakeNav];

        // 保存到数据库
        await saveFundHistory(history);
        navCache.set(cleanCode, fakeNav);

        // 保存基金信息
        if (fundData.name) {
          await saveFundInfo(cleanCode, fundData.name, 'eastmoney');
        } else {
          await saveFundInfo(cleanCode, cleanCode, 'eastmoney');
        }
      } else {
        // 如果天天基金失败，可以回退到新浪（可选）
        console.log(`[基金服务] 天天基金获取失败，尝试新浪财经...`);
        history = await fetchFundHistoryFromSina(cleanCode, 1);

        if (history.length === 0) {
          console.error(`[基金服务] 所有数据源均失败，无法获取数据`);
          return {
            success: false,
            data: null,
            error: `未找到基金 ${cleanCode} 的数据，请确认代码是否正确`,
            source: 'FundService'
          };
        }

        usedSource = 'sina';
        await saveFundHistory(history);
        const latest = history[history.length - 1];
        navCache.set(cleanCode, latest);
        await saveFundInfo(cleanCode, cleanCode, 'sina');
      }
    } else {
      console.log(`[基金服务] 使用缓存数据`);
    }

    // 获取基金名称
    let fundName = cleanCode;
    try {
      const info = await getFundInfo(cleanCode);
      if (info && info.name) {
        fundName = info.name;
        console.log(`[基金服务] 基金名称: ${fundName}`);
      }
    } catch (e) {
      console.warn(`[基金服务] 获取基金名称失败`, e);
    }

    // 从数据库获取完整历史数据（用于走势图）
    const dbHistory = await getFundHistory(cleanCode, 365);
    console.log(`[基金服务] 从数据库读取到 ${dbHistory.length} 条历史数据`);

    let latestNav = navCache.get(cleanCode);
    if (!latestNav && dbHistory.length > 0) {
      latestNav = dbHistory[dbHistory.length - 1];
      navCache.set(cleanCode, latestNav);
    }

    if (!latestNav) {
      console.error(`[基金服务] 无法获取最新净值`);
      return {
        success: false,
        data: null,
        error: `无法获取基金 ${cleanCode} 的最新净值`,
        source: 'FundService'
      };
    }

    const asset: UnifiedAsset = {
      symbol: `${cleanCode}.OF`,
      name: fundName,
      price: latestNav.nav,
      changePercent: latestNav.change,
      currency: 'CNY',
      market: '中国场外基金市场',
      type: 'fund',
      source: usedSource || 'cache',
      lastUpdated: `${latestNav.date}T15:00:00.000Z`,
      metadata: {
        history: dbHistory.map(h => ({ date: h.date, value: h.nav }))
      }
    };

    console.log(`[基金服务] 成功返回数据: ${asset.name} ${asset.price}`);
    return { success: true, data: asset, source: 'FundService' };

  } catch (error: any) {
    console.error(`[基金服务] 异常:`, error);
    return {
      success: false,
      data: null,
      error: error.message || '基金搜索失败',
      source: 'FundService'
    };
  }
}

/**
 * 只更新基金数据到数据库，不返回前端资产（用于后台自动更新）
 */
export async function updateFundData(code: string): Promise<void> {
  const cleanCode = code.replace(/\.OF$/, '');
  console.log(`[自动更新] 开始更新基金: ${cleanCode}`);

  try {
    const needUpdate = await needsUpdate(cleanCode);
    if (!needUpdate) {
      console.log(`[自动更新] 基金 ${cleanCode} 今日已更新，跳过`);
      return;
    }

    // 优先尝试天天基金
    const fundData = await queryEastMoneyFund(cleanCode);
    let history: FundNav[] = [];
    let source = 'eastmoney';

    if (fundData) {
      const fakeNav: FundNav = {
        code: cleanCode,
        date: fundData.navDate,
        nav: fundData.price,
        accumNav: fundData.price,
        change: fundData.changePercent,
      };
      history = [fakeNav];
      if (fundData.name) {
        await saveFundInfo(cleanCode, fundData.name, source);
      } else {
        await saveFundInfo(cleanCode, cleanCode, source);
      }
    } else {
      console.log(`[自动更新] 天天基金失败，尝试新浪财经`);
      history = await fetchFundHistoryFromSina(cleanCode, 1);
      source = 'sina';
    }

    if (history.length > 0) {
      await saveFundHistory(history);
      const info = await getFundInfo(cleanCode);
      await saveFundInfo(cleanCode, info?.name || cleanCode, source);
      console.log(`[自动更新] 基金 ${cleanCode} 已保存 ${history.length} 条数据`);
    } else {
      console.warn(`[自动更新] 基金 ${cleanCode} 无法从任何源获取数据`);
    }
  } catch (error) {
    console.error(`[自动更新] 基金 ${cleanCode} 处理异常:`, error);
  }
}