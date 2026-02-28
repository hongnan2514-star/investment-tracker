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

// ==================== 股票分钟级数据 ====================
export interface StockMinute {
  symbol: string;
  timestamp: number;      // Unix 秒级时间戳
  resolution: string;     // 分辨率，例如 '5m'
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
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

/**
 * 保存股票分钟级数据（批量，冲突忽略）
 */
export async function saveStockMinute(records: StockMinute[]): Promise<void> {
  for (const r of records) {
    await sql`
      INSERT INTO stock_minute_history (symbol, timestamp, resolution, open, high, low, close, volume)
      VALUES (${r.symbol}, ${r.timestamp}, ${r.resolution}, ${r.open}, ${r.high}, ${r.low}, ${r.close}, ${r.volume})
      ON CONFLICT (symbol, timestamp, resolution) DO NOTHING
    `;
  }
}

/**
 * 获取最近 N 条股票分钟级数据（按时间降序）
 * @param symbol 股票代码（带后缀，如 "AAPL" 或 "600519.SS"）
 * @param resolution 分辨率，固定为 '5m'
 * @param limit 条数，默认288（24小时*12个5分钟）
 */
export async function getStockMinuteHistory(symbol: string, resolution: string, limit: number = 288): Promise<StockMinute[]> {
  const result = await sql`
    SELECT * FROM stock_minute_history
    WHERE symbol = ${symbol} AND resolution = ${resolution}
    ORDER BY timestamp DESC
    LIMIT ${limit}
  `;
  return result as StockMinute[];
}

/**
 * 检查是否需要更新股票分钟级数据
 * @param symbol 股票代码
 * @param resolution 分辨率，如 '5m'
 * @param maxAgeSeconds 最大允许的数据年龄（秒），例如 15*60 表示15分钟
 */
export async function needsStockMinuteUpdate(symbol: string, resolution: string, maxAgeSeconds: number): Promise<boolean> {
  const result = await sql`
    SELECT timestamp FROM stock_minute_history
    WHERE symbol = ${symbol} AND resolution = ${resolution}
    ORDER BY timestamp DESC LIMIT 1
  `;
  const row = result[0] as { timestamp: number } | undefined;
  if (!row) return true;
  const lastTime = row.timestamp * 1000;
  const now = Date.now();
  return (now - lastTime) > maxAgeSeconds * 1000;
}

/**
 * 从 Yahoo Finance 获取股票5分钟数据并更新到数据库（冲突忽略）
 * @param symbol 股票代码（带后缀，如 "AAPL" 或 "600519.SS"）
 * @param days 最多获取多少天的数据（Yahoo 分钟数据最多支持60天）
 */

export async function updateStockMinuteHistory(symbol: string): Promise<number> {
  const maxRetries = 3;
  const baseDelay = 5000; // 5秒基础等待

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // 计算最近5天的范围（足够5个交易日）
      const to = Math.floor(Date.now() / 1000);
      const from = to - 5 * 24 * 60 * 60; // 5天前

      // 使用 query2 端点，模拟浏览器请求头
      const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=15m&period1=${from}&period2=${to}`;
      console.log(`获取 ${symbol} 15分钟数据 (尝试 ${attempt}/${maxRetries})`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json,text/plain,*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://finance.yahoo.com/',
        },
      });
      clearTimeout(timeoutId);

      // 处理频率限制
      if (res.status === 429) {
        const waitTime = baseDelay * Math.pow(2, attempt - 1); // 指数退避：5s, 10s, 20s
        console.warn(`Yahoo 频率限制 (429)，等待 ${waitTime/1000} 秒后重试...`);
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, waitTime));
          continue;
        } else {
          console.error(`达到最大重试次数，放弃获取 ${symbol} 分钟数据`);
          return 0;
        }
      }

      if (!res.ok) {
        console.warn(`Yahoo请求失败 (${res.status})`);
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, baseDelay));
          continue;
        }
        return 0;
      }

      const data = await res.json();

      // 处理Yahoo返回的业务错误
      if (data.chart?.error) {
        console.error(`Yahoo错误:`, data.chart.error);
        return 0;
      }

      if (!data.chart?.result?.[0]) {
        console.warn(`Yahoo返回空数据`);
        return 0;
      }

      const result = data.chart.result[0];
      const timestamps: number[] = result.timestamp;
      const quote = result.indicators?.quote?.[0];
      if (!timestamps || !quote) return 0;

      // 构建记录
      const records: StockMinute[] = [];
      for (let i = 0; i < timestamps.length; i++) {
        const open = quote.open?.[i];
        const high = quote.high?.[i];
        const low = quote.low?.[i];
        const close = quote.close?.[i];
        const volume = quote.volume?.[i];
        if (open == null || high == null || low == null || close == null || volume == null) continue;

        records.push({
          symbol,
          timestamp: timestamps[i],
          resolution: '15m',
          open,
          high,
          low,
          close,
          volume,
        });
      }

      if (records.length > 0) {
        await saveStockMinute(records);
        console.log(`[股票分钟更新] ${symbol} 已保存 ${records.length} 条15分钟数据`);
        return records.length;
      }
      return 0;
    } catch (error: any) {
      console.error(`请求异常:`, error.message);
      if (attempt < maxRetries) {
        const waitTime = baseDelay * Math.pow(2, attempt - 1);
        await new Promise(r => setTimeout(r, waitTime));
      }
    }
  }
  return 0;
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