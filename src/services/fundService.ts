// src/services/fundService.ts
import {
  saveFundHistory,
  getFundHistory,
  needsUpdate,
  getFundInfo,
  saveFundInfo,
  getLatestFundNav,
} from './fundHistoryDB';
import { queryEastMoneyFund } from '@/app/api/data-sources/eastmoney-fund';
import { DataSourceResult, UnifiedAsset } from '@/app/api/data-sources/types';

// 搜索结果缓存 (5分钟)
interface CacheEntry {
  result: DataSourceResult;
  timestamp: number;
}
const fundCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5分钟

// 最新净值内存缓存 (用于快速获取)
const navCache = new Map<string, FundNav>();

export interface FundNav {
  code: string;
  date: string;
  nav: number;
  accumNav: number;
  change: number;
}

/**
 * 搜索基金并获取历史数据
 */
export async function searchFund(code: string): Promise<DataSourceResult> {
  const cleanCode = code.replace(/\.OF$/, '');
  console.log(`[基金服务] 开始搜索基金: ${cleanCode}`);

  // 1. 检查缓存
  const cached = fundCache.get(cleanCode);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[基金服务] 使用缓存数据 for ${cleanCode}`);
    return cached.result;
  }

  try {
    const needUpdate = await needsUpdate(cleanCode);
    console.log(`[基金服务] needUpdate = ${needUpdate}`);

    let history: FundNav[] = [];
    let usedSource = '';

    if (needUpdate) {
      console.log(`[基金服务] 需要更新，尝试天天基金...`);
      const fundData = await queryEastMoneyFund(cleanCode);

      if (fundData) {
        console.log(`[基金服务] 天天基金获取成功`);
        usedSource = 'eastmoney';

        const today = fundData.jzrq || new Date().toISOString().split('T')[0];
const fakeNav: FundNav = {
  code: cleanCode,
  date: today,
  nav: parseFloat(fundData.dwjz) || 0,
  accumNav: parseFloat(fundData.dwjz) || 0,
  change: parseFloat(fundData.gszzl) || 0,
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
        // 天天基金失败，尝试从数据库获取最新净值
        console.log(`[基金服务] 天天基金获取失败，尝试读取数据库最新净值`);
        const latestNavFromDb = await getLatestFundNav(cleanCode);
        if (latestNavFromDb) {
          console.log(`[基金服务] 从数据库读取到最新净值: ${latestNavFromDb.nav} (${latestNavFromDb.date})`);
          usedSource = 'database';
          history = [latestNavFromDb];
          navCache.set(cleanCode, latestNavFromDb);
          // 不重新保存 fund_info，因为可能已有记录；如果需要，可以更新 last_update 为今天，但净值未变
        } else {
          console.error(`[基金服务] 数据库中也无基金数据，无法获取`);
          return {
            success: false,
            data: null,
            error: `未找到基金 ${cleanCode} 的数据，请确认代码是否正确或稍后重试`,
            source: 'FundService',
          };
        }
      }
    } else {
      console.log(`[基金服务] 使用缓存数据`);
    }

    // 2. 获取基金名称（从 fund_info 表）
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

    // 3. 从数据库获取完整历史数据（用于走势图）
    const dbHistory = await getFundHistory(cleanCode, 365);
    console.log(`[基金服务] 从数据库读取到 ${dbHistory.length} 条历史数据`);

    // 4. 确定最新净值（优先用内存缓存，否则从历史数据取）
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
        source: 'FundService',
      };
    }

    // 5. 组装统一资产格式
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
        history: dbHistory.map(h => ({ date: h.date, value: h.nav })),
      },
    };

    const result: DataSourceResult = { success: true, data: asset, source: 'FundService' };

    // 6. 存入缓存
    fundCache.set(cleanCode, { result, timestamp: Date.now() });

    console.log(`[基金服务] 成功返回数据: ${asset.name} ${asset.price}`);
    return result;
  } catch (error: any) {
    console.error(`[基金服务] 异常:`, error);
    return {
      success: false,
      data: null,
      error: error.message || '基金搜索失败',
      source: 'FundService',
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

    // 尝试天天基金
    const fundData = await queryEastMoneyFund(cleanCode);
    let history: FundNav[] = [];
    let source = 'eastmoney';

    if (fundData) {
      const fakeNav: FundNav = {
  code: cleanCode,
  date: fundData.jzrq,
  nav: parseFloat(fundData.dwjz) || 0,
  accumNav: parseFloat(fundData.dwjz) || 0,
  change: parseFloat(fundData.gszzl) || 0,
};
      history = [fakeNav];
      if (fundData.name) {
        await saveFundInfo(cleanCode, fundData.name, source);
      } else {
        await saveFundInfo(cleanCode, cleanCode, source);
      }
    } else {
      // 天天基金失败，且 needUpdate 为 true（数据库非最新），故不更新
      console.log(`[自动更新] 天天基金失败，数据库可能非最新，跳过本次更新`);
      return;
    }

    if (history.length > 0) {
      await saveFundHistory(history);
      const info = await getFundInfo(cleanCode);
      await saveFundInfo(cleanCode, info?.name || cleanCode, source);
      console.log(`[自动更新] 基金 ${cleanCode} 已保存 ${history.length} 条数据`);
    }
  } catch (error) {
    console.error(`[自动更新] 基金 ${cleanCode} 处理异常:`, error);
  }
}