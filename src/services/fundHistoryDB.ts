// src/services/fundHistoryDB.ts
import { neon } from '@neondatabase/serverless';

// ==================== 类型定义 ====================
export interface FundNav {
  code: string;
  date: string;      // YYYY-MM-DD
  nav: number;       // 单位净值
  accumNav: number;  // 累计净值
  change: number;    // 日增长率
}

export interface StockPrice {
  symbol: string;
  date: string;      // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CryptoPrice {
  symbol: string;    // 例如 "BTC/USDT"
  date: string;      // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CryptoMinute {
  symbol: string;        // 交易对，如 "BTC/USDT"
  timestamp: number;     // Unix 秒级时间戳（分钟的开始时间）
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  resolution: string;    // 分辨率，例如 '5m', '15m'
}

// ==================== 数据库连接 ====================
// 从环境变量获取 Neon PostgreSQL 连接字符串（Vercel 自动注入，本地需在 .env.local 中配置）
const sql = neon(process.env.POSTGRES_URL!);

// ==================== 基金相关函数 ====================

/**
 * 从新浪财经获取基金历史净值数据（不依赖数据库）
 * @param code 基金代码，如 "017174"
 * @param years 获取几年数据，默认1年
 */
export async function fetchFundHistoryFromSina(code: string, years: number = 1): Promise<FundNav[]> {
  try {
    console.log(`[新浪财经] 开始获取基金 ${code} 历史数据...`);
    const url = `https://stock.finance.sina.com.cn/fundInfo/api/openapi.php/CaihuiFundInfoService.getNav`;
    const params = new URLSearchParams({
      fund: code,
      page: '1',
      num: '1000'
    });

    const response = await fetch(`${url}?${params}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Referer': 'https://finance.sina.com.cn/',
        'Connection': 'keep-alive'
      }
    });

    if (!response.ok) {
      console.error(`[新浪财经] HTTP error! status: ${response.status}`);
      return [];
    }

    const data = await response.json();

    if (data.result?.data?.length > 0) {
      console.log(`[新浪财经] 获取到 ${data.result.data.length} 条原始数据`);

      const history: FundNav[] = data.result.data.map((item: any) => ({
        code: code,
        date: item.nav_date,
        nav: parseFloat(item.dwjz) || 0,
        accumNav: parseFloat(item.ljjz) || 0,
        change: parseFloat(item.rzzl) || 0
      }));

      history.sort((a, b) => a.date.localeCompare(b.date));

      const cutoffDate = new Date();
      cutoffDate.setFullYear(cutoffDate.getFullYear() - years);
      const cutoffStr = cutoffDate.toISOString().split('T')[0];

      const filteredHistory = history.filter(item => item.date >= cutoffStr);

      console.log(`[新浪财经] 过滤后得到 ${filteredHistory.length} 条数据`);
      return filteredHistory;
    } else {
      console.warn(`[新浪财经] 未找到基金 ${code} 的数据`);
      return [];
    }
  } catch (error) {
    console.error(`[新浪财经] 获取 ${code} 历史数据失败:`, error);
    return [];
  }
}

/**
 * 保存基金历史净值到数据库（异步）
 */
export async function saveFundHistory(records: FundNav[]): Promise<void> {
  for (const r of records) {
    await sql`
      INSERT INTO fund_nav_history (code, date, nav, accum_nav, change)
      VALUES (${r.code}, ${r.date}, ${r.nav}, ${r.accumNav}, ${r.change})
      ON CONFLICT (code, date) DO UPDATE SET
        nav = EXCLUDED.nav,
        accum_nav = EXCLUDED.accum_nav,
        change = EXCLUDED.change
    `;
  }
}

/**
 * 获取基金历史数据
 * @param code 基金代码
 * @param days 获取最近多少天的数据，默认365天
 */
export async function getFundHistory(code: string, days: number = 365): Promise<FundNav[]> {
  const result = await sql`
    SELECT * FROM fund_nav_history 
    WHERE code = ${code}
    AND date >= CURRENT_DATE - ${days} * INTERVAL '1 day'
    ORDER BY date ASC
  `;
  return result as FundNav[];
}

/**
 * 检查是否需要更新（根据数据来源智能判断）
 */
export async function needsUpdate(code: string): Promise<boolean> {
  const result = await sql`
    SELECT last_update, source FROM fund_info WHERE code = ${code}
  `;
  const info = result[0] as { last_update: string; source: string } | undefined;

  if (!info) return true; // 没有记录，需要更新

  const today = new Date().toISOString().split('T')[0];
  const last = info.last_update;

  if (info.source === 'akshare') {
    // AKShare 数据一周更新一次
    const lastDate = new Date(last);
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    return lastDate < oneWeekAgo;
  } else {
    // 默认每天更新
    return last !== today;
  }
}

/**
 * 获取基金信息（名称和来源）
 */
export async function getFundInfo(code: string): Promise<{ name: string; source: string } | undefined> {
  const result = await sql`
    SELECT name, source FROM fund_info WHERE code = ${code}
  `;
  return result[0] as { name: string; source: string } | undefined;
}

/**
 * 保存基金名称和来源（自动更新 last_update 为今天）
 */
export async function saveFundInfo(code: string, name: string, source: string = 'sina'): Promise<void> {
  await sql`
    INSERT INTO fund_info (code, name, last_update, source)
    VALUES (${code}, ${name}, CURRENT_DATE, ${source})
    ON CONFLICT (code) DO UPDATE SET
      name = EXCLUDED.name,
      last_update = EXCLUDED.last_update,
      source = EXCLUDED.source
  `;
  console.log(`[DB] 基金信息保存成功: ${code} -> ${name} (来源: ${source})`);
}

/**
 * 获取所有已存在基金代码（用于自动更新）
 */
export async function getAllFundCodes(): Promise<string[]> {
  const result = await sql`SELECT code FROM fund_info`;
  return result.map((row: any) => row.code);
}

// ==================== 股票相关函数 ====================

/**
 * 获取股票历史价格
 * @param symbol 股票代码（如 "AAPL"）
 * @param days 获取最近多少天的数据，默认365天
 */
export async function getStockHistory(symbol: string, days: number = 365): Promise<StockPrice[]> {
  const result = await sql`
    SELECT * FROM stock_price_history 
    WHERE symbol = ${symbol}
    AND date >= CURRENT_DATE - ${days} * INTERVAL '1 day'
    ORDER BY date ASC
  `;
  return result as StockPrice[];
}

/**
 * 保存股票历史价格（批量）
 */
export async function saveStockHistory(records: StockPrice[]): Promise<void> {
  for (const r of records) {
    await sql`
      INSERT INTO stock_price_history (symbol, date, open, high, low, close, volume)
      VALUES (${r.symbol}, ${r.date}, ${r.open}, ${r.high}, ${r.low}, ${r.close}, ${r.volume})
      ON CONFLICT (symbol, date) DO UPDATE SET
        open = EXCLUDED.open,
        high = EXCLUDED.high,
        low = EXCLUDED.low,
        close = EXCLUDED.close,
        volume = EXCLUDED.volume
    `;
  }
}

/**
 * 检查是否需要更新股票历史数据
 * 如果最近一条数据距今超过3天，则返回 true（需要更新）
 */
export async function needsStockUpdate(symbol: string): Promise<boolean> {
  const result = await sql`
    SELECT date FROM stock_price_history 
    WHERE symbol = ${symbol}
    ORDER BY date DESC LIMIT 1
  `;
  const row = result[0] as { date: string } | undefined;
  if (!row) return true;
  const lastDate = new Date(row.date);
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - 3);
  return lastDate < threshold;
}

// ==================== 加密货币日线数据 ====================

/**
 * 获取加密货币历史价格（日线）
 * @param symbol 交易对，如 "BTC/USDT"
 * @param days 获取最近多少天的数据，默认365天
 */
export async function getCryptoHistory(symbol: string, days: number = 365): Promise<CryptoPrice[]> {
  const result = await sql`
    SELECT * FROM crypto_price_history 
    WHERE symbol = ${symbol}
    AND date >= CURRENT_DATE - ${days} * INTERVAL '1 day'
    ORDER BY date ASC
  `;
  return result as CryptoPrice[];
}

/**
 * 保存加密货币历史价格（批量）
 */
export async function saveCryptoHistory(records: CryptoPrice[]): Promise<void> {
  for (const r of records) {
    await sql`
      INSERT INTO crypto_price_history (symbol, date, open, high, low, close, volume)
      VALUES (${r.symbol}, ${r.date}, ${r.open}, ${r.high}, ${r.low}, ${r.close}, ${r.volume})
      ON CONFLICT (symbol, date) DO UPDATE SET
        open = EXCLUDED.open,
        high = EXCLUDED.high,
        low = EXCLUDED.low,
        close = EXCLUDED.close,
        volume = EXCLUDED.volume
    `;
  }
}

/**
 * 检查是否需要更新加密货币历史数据
 * 如果最近一条数据距今超过1天，则返回 true（需要更新）
 */
export async function needsCryptoUpdate(symbol: string): Promise<boolean> {
  const result = await sql`
    SELECT date FROM crypto_price_history 
    WHERE symbol = ${symbol}
    ORDER BY date DESC LIMIT 1
  `;
  const row = result[0] as { date: string } | undefined;
  if (!row) return true;
  const lastDate = new Date(row.date);
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - 1);
  return lastDate < threshold;
}

// ==================== 加密货币分钟级数据 ====================

/**
 * 保存加密货币分钟级数据
 */
export async function saveCryptoMinute(records: CryptoMinute[]): Promise<void> {
  for (const r of records) {
    await sql`
      INSERT INTO crypto_minute_history (symbol, timestamp, resolution, open, high, low, close, volume)
      VALUES (${r.symbol}, ${r.timestamp}, ${r.resolution}, ${r.open}, ${r.high}, ${r.low}, ${r.close}, ${r.volume})
      ON CONFLICT (symbol, timestamp, resolution) DO UPDATE SET
        open = EXCLUDED.open,
        high = EXCLUDED.high,
        low = EXCLUDED.low,
        close = EXCLUDED.close,
        volume = EXCLUDED.volume
    `;
  }
}

/**
 * 获取最近 N 条分钟级数据（按时间降序）
 * @param symbol 交易对
 * @param resolution 分辨率，如 '5m', '15m'
 * @param limit 条数，默认288（24小时*12个5分钟）
 */
export async function getCryptoMinuteHistory(symbol: string, resolution: string, limit: number = 288): Promise<CryptoMinute[]> {
  const result = await sql`
    SELECT * FROM crypto_minute_history
    WHERE symbol = ${symbol} AND resolution = ${resolution}
    ORDER BY timestamp DESC
    LIMIT ${limit}
  `;
  return result as CryptoMinute[];
}

/**
 * 检查是否需要更新分钟级数据
 * @param symbol 交易对
 * @param resolution 分辨率，如 '5m'
 * @param maxAgeSeconds 最大允许的数据年龄（秒），例如 5*60 表示5分钟
 */
export async function needsCryptoMinuteUpdate(symbol: string, resolution: string, maxAgeSeconds: number): Promise<boolean> {
  const result = await sql`
    SELECT timestamp FROM crypto_minute_history
    WHERE symbol = ${symbol} AND resolution = ${resolution}
    ORDER BY timestamp DESC LIMIT 1
  `;
  const row = result[0] as { timestamp: number } | undefined;
  if (!row) return true;
  const lastTime = row.timestamp * 1000;
  const now = Date.now();
  return (now - lastTime) > maxAgeSeconds * 1000;
}