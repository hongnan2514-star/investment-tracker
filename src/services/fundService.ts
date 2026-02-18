import { fetchFundHistoryFromSina, saveFundHistory, getFundHistory, needsUpdate, getFundInfo, saveFundInfo } from './fundHistoryDB';
import { queryAKShareFund } from '@/app/api/data-sources/akshare'; // 引入 AKShare 后备
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
    const needUpdate = needsUpdate(cleanCode);
    console.log(`[基金服务] needUpdate = ${needUpdate}`);

    let history: FundNav[] = [];

    if (needUpdate) {
      console.log(`[基金服务] 需要更新，尝试新浪财经...`);
      history = await fetchFundHistoryFromSina(cleanCode, 1);
      
      // 如果新浪财经无数据，回退到 AKShare
      if (history.length === 0) {
        console.log(`[基金服务] 新浪财经无数据，尝试 AKShare 后备...`);
        const akResult = await queryAKShareFund(code); // 注意传入原始 code（可能带 .OF）
        if (akResult.success && akResult.data) {
          console.log(`[基金服务] AKShare 获取成功，构造单点数据`);
          const today = new Date().toISOString().split('T')[0];
          const fakeNav: FundNav = {
            code: cleanCode,
            date: today,
            nav: akResult.data.price ?? 0,
            accumNav: akResult.data.price ?? 0,
            change: akResult.data.changePercent ?? 0
          };
          history = [fakeNav];
          // 保存到数据库
          saveFundHistory(history);
          navCache.set(cleanCode, fakeNav);
          // 保存基金信息（标记为 akshare 源）
          if (akResult.data.name) {
            saveFundInfo(cleanCode, akResult.data.name, 'akshare');
          } else {
            saveFundInfo(cleanCode, cleanCode, 'akshare');
          }
        } else {
          console.error(`[基金服务] AKShare 也失败，无法获取数据`);
          return {
            success: false,
            data: null,
            error: `未找到基金 ${cleanCode} 的数据，请确认代码是否正确`,
            source: 'FundService'
          };
        }
      }

      // 如果新浪财经有数据，保存（标记为 sina 源）
      if (history.length > 0 && history[0].code === cleanCode) {
        console.log(`[基金服务] 保存 ${history.length} 条历史数据到数据库...`);
        saveFundHistory(history);
        const latest = history[history.length - 1];
        navCache.set(cleanCode, latest);
        // 保存基金信息（名称暂时未知，先用 code 代替，source 为 sina）
        saveFundInfo(cleanCode, cleanCode, 'sina');
        console.log(`[基金服务] 最新净值: ${latest.nav} (${latest.date})`);
      }
    } else {
      console.log(`[基金服务] 使用缓存数据`);
    }

    // 获取基金名称
    let fundName = cleanCode;
    try {
      const info = getFundInfo(cleanCode);
      if (info && info.name) {
        fundName = info.name;
        console.log(`[基金服务] 基金名称: ${fundName}`);
      }
    } catch (e) {
      console.warn(`[基金服务] 获取基金名称失败`, e);
    }

    // 从数据库获取完整历史数据（用于走势图）
    const dbHistory = getFundHistory(cleanCode, 365);
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
      source: 'FundService',
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
    const needUpdate = needsUpdate(cleanCode);
    if (!needUpdate) {
      console.log(`[自动更新] 基金 ${cleanCode} 今日已更新，跳过`);
      return;
    }

    // 先尝试新浪财经
    let history = await fetchFundHistoryFromSina(cleanCode, 1);
    let source = 'sina';

    if (history.length === 0) {
      console.log(`[自动更新] 新浪无数据，尝试 AKShare`);
      const akResult = await queryAKShareFund(code);
      if (akResult.success && akResult.data) {
        const today = new Date().toISOString().split('T')[0];
        const fakeNav: FundNav = {
          code: cleanCode,
          date: today,
          nav: akResult.data.price ?? 0,
          accumNav: akResult.data.price ?? 0,
          change: akResult.data.changePercent ?? 0
        };
        history = [fakeNav];
        source = 'akshare';
        if (akResult.data.name) {
          saveFundInfo(cleanCode, akResult.data.name, source);
        }
      } else {
        console.warn(`[自动更新] 基金 ${cleanCode} 无法从任何源获取数据`);
        return;
      }
    }

    if (history.length > 0) {
      saveFundHistory(history);
      const info = getFundInfo(cleanCode);
      saveFundInfo(cleanCode, info?.name || cleanCode, source);
      console.log(`[自动更新] 基金 ${cleanCode} 已保存 ${history.length} 条数据`);
    }
  } catch (error) {
    console.error(`[自动更新] 基金 ${cleanCode} 处理异常:`, error);
  }
}