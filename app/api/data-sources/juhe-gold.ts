// /app/api/data-sources/juhe-gold.ts
import { DataSourceResult, UnifiedAsset } from "./types";

const JUHE_GOLD_KEY = process.env.JUHE_GOLD_KEY;

// 品种映射表（将用户输入的代码映射到 API 返回的 variety 字段）
const metalMap: Record<string, string> = {
  // 黄金
  'Au999': 'Au99.99',
  '黄金': 'Au99.99',
  'Au99.99': 'Au99.99',
  'Au99.95': 'Au99.95',
  'Au100g': 'Au100g',
  'AuT+D': 'Au(T+D)',
  'Au(T+D)': 'Au(T+D)',
  'AuT+N1': 'Au(T+N1)',
  'Au(T+N1)': 'Au(T+N1)',
  'AuT+N2': 'Au(T+N2)',
  'Au(T+N2)': 'Au(T+N2)',

  // 白银
  'Ag999': 'Ag99.99',
  'Ag99.9': 'Ag99.99',
  '白银': 'Ag99.99',
  'Ag99.99': 'Ag99.99',
  'AgT+D': 'Ag(T+D)',
  'Ag(T+D)': 'Ag(T+D)',

  // 铂金
  'Pt99.95': 'Pt99.95',
};

// 中文名称映射（用于友好显示）
const nameMap: Record<string, string> = {
  'Au99.99': '黄金99.99',
  'Au99.95': '黄金99.95',
  'Au100g': '黄金100g',
  'Au(T+D)': '黄金 T+D',
  'Au(T+N1)': '黄金 T+N1',
  'Au(T+N2)': '黄金 T+N2',
  'Ag99.99': '白银99.99',
  'Ag(T+D)': '白银 T+D',
  'Pt99.95': '铂金99.95',
};

// 简单内存缓存：键为品种代码，值为 { data, expiresAt }
const cache = new Map<string, { data: UnifiedAsset; expiresAt: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30分钟缓存（每小时最多2次）

/**
 * 查询聚合数据黄金接口（带30分钟缓存）
 * @param code 用户输入的代码，如 'Au999', '黄金', 'AuT+D'
 */
export async function queryJuheGold(code: string): Promise<DataSourceResult> {
  if (!JUHE_GOLD_KEY) {
    return { success: false, data: null, error: '聚合黄金 key 未配置', source: 'JuheGold' };
  }

  const variety = metalMap[code];
  if (!variety) {
    return { success: false, data: null, error: `不支持的贵金属代码: ${code}`, source: 'JuheGold' };
  }

  // 检查缓存
  const cacheKey = variety;
  const cached = cache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    console.log(`[聚合黄金] 使用缓存数据 for ${variety}`);
    return { success: true, data: cached.data, source: 'JuheGold (cached)' };
  }

  try {
    const url = `https://web.juhe.cn/finance/gold/shgold?key=${JUHE_GOLD_KEY}`;
    console.log(`[聚合黄金] 请求URL: ${url}`);
    const response = await fetch(url);
    const data = await response.json();
    console.log(`[聚合黄金] 响应:`, JSON.stringify(data).substring(0, 300));

    if (data.error_code !== 0) {
      return { success: false, data: null, error: data.reason || '聚合黄金查询失败', source: 'JuheGold' };
    }

    // 解析 result
    const items = data.result || [];
    let foundItem = null;

    for (const entry of items) {
      for (const key in entry) {
        const candidate = entry[key];
        if (candidate && candidate.variety === variety) {
          foundItem = candidate;
          break;
        }
      }
      if (foundItem) break;
    }

    if (!foundItem) {
      return { success: false, data: null, error: `未找到 ${variety} 的数据`, source: 'JuheGold' };
    }

    const parsePrice = (val: string) => val === '--' ? 0 : parseFloat(val) || 0;

    const price = parsePrice(foundItem.latestpri);
    const yespri = parsePrice(foundItem.yespri);
    const changePercent = yespri ? ((price - yespri) / yespri * 100) : 0;

    // 生成友好名称
    const displayName = nameMap[variety] || `贵金属 (${code})`;

    const asset: UnifiedAsset = {
      symbol: code,
      name: displayName,
      price: price,
      changePercent: changePercent,
      currency: 'CNY',
      market: '上海黄金交易所',
      type: 'metal',
      source: 'JuheGold',
      lastUpdated: foundItem.time ? new Date(foundItem.time).toISOString() : new Date().toISOString(),
      metadata: {
        open: parsePrice(foundItem.openpri),
        high: parsePrice(foundItem.maxpri),
        low: parsePrice(foundItem.minpri),
        volume: parseFloat(foundItem.totalvol) || 0,
        prevClose: parsePrice(foundItem.yespri),
      }
    };

    // 存入缓存，设置30分钟后过期
    cache.set(cacheKey, { data: asset, expiresAt: now + CACHE_TTL_MS });
    console.log(`[聚合黄金] 缓存已更新 for ${variety}`);

    return { success: true, data: asset, source: 'JuheGold' };
  } catch (error: any) {
    console.error('[聚合黄金] 查询异常:', error);
    return { success: false, data: null, error: error.message, source: 'JuheGold' };
  }
}