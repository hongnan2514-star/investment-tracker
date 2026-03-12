// app/api/data-sources/tiingo-stock.ts
import { config } from 'dotenv';
config({ path: '.env.local' });

// ==================== Tiingo 速率限制器 ====================
// 免费版每小时最多 50 次请求
class TiingoRateLimiter {
  private requestTimestamps: number[] = [];
  private readonly maxRequests = 50;
  private readonly intervalMs = 60 * 60 * 1000; // 1 小时

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    // 移除超过 1 小时的时间戳
    this.requestTimestamps = this.requestTimestamps.filter(ts => now - ts < this.intervalMs);

    if (this.requestTimestamps.length >= this.maxRequests) {
      // 已达到上限，计算需要等待的时间
      const oldest = this.requestTimestamps[0];
      const waitTime = oldest + this.intervalMs - now;
      console.log(`[Tiingo] 达到请求上限，等待 ${(waitTime / 1000).toFixed(1)} 秒`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      // 等待后重新检查（递归调用）
      return this.waitForSlot();
    }

    // 记录本次请求
    this.requestTimestamps.push(now);
  }
}

const tiingoRateLimiter = new TiingoRateLimiter();

const TIINGO_TOKEN = process.env.TIINGO_TOKEN;
if (!TIINGO_TOKEN) {
  throw new Error("请在 .env.local 中设置 TIINGO_TOKEN");
}

/**
 * 从 Tiingo IEX 获取股票分钟级 OHLCV 数据
 * @param symbol 股票代码，如 "AAPL"
 * @param interval 时间粒度，支持 '1m','5m','15m','30m','1h','4h','6h','1d' 等，内部自动映射为 Tiingo 格式
 * @param limit 最大条数（仅当 since 未提供时用于估算起始日期）
 * @param sinceTimestamp 可选，起始时间戳（毫秒），只拉取此时间之后的数据
 */
export async function fetchTiingoMinuteData(
  symbol: string,
  interval: string = '15m',
  limit: number = 200,
  sinceTimestamp?: number
): Promise<{ timestamp: number; open: number; high: number; low: number; close: number; volume: number }[] | null> {
  await tiingoRateLimiter.waitForSlot(); // 新增速率限制
  console.log(`[Tiingo] 开始 fetchTiingoMinuteData: symbol=${symbol}, interval=${interval}, limit=${limit}, sinceTimestamp=${sinceTimestamp}`);

  // 映射 interval 到 Tiingo 支持的格式
  const intervalMap: Record<string, string> = {
    '1m': '1Min',
    '5m': '5Min',
    '15m': '15Min',
    '30m': '30Min',
    '1h': '1Hour',
    '1hour': '1Hour',
    '4h': '4Hour',
    '6h': '6Hour',  // 如果 Tiingo 不支持6小时，可改用 '4Hour' 或 '1Day'
    '1d': '1Day',
  };
  const tiingoInterval = intervalMap[interval] || interval;
  console.log(`[Tiingo] 映射后 interval: ${tiingoInterval}`);

  try {
    const toDate = new Date();
    let fromDate: Date;

    if (sinceTimestamp) {
      fromDate = new Date(sinceTimestamp);
      console.log(`[Tiingo] 使用 sinceTimestamp: ${fromDate.toISOString()}`);
    } else {
      // 根据 limit 估算起始日期，并至少设为5天前，以覆盖周末非交易日
      const intervalMinutes: Record<string, number> = {
        '1Min': 1, '5Min': 5, '15Min': 15, '30Min': 30,
        '1Hour': 60, '4Hour': 240, '6Hour': 360, '1Day': 1440
      };
      const mins = intervalMinutes[tiingoInterval] || 15;
      let days = Math.ceil((limit * mins) / (60 * 24));
      days = Math.max(days, 5); // 至少5天，确保跨过周末
      fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);
      console.log(`[Tiingo] 根据 limit 估算 fromDate (至少5天): ${fromDate.toISOString()}`);
    }

    const fromStr = fromDate.toISOString().split('T')[0];
    const toStr = toDate.toISOString().split('T')[0];

    const url = `https://api.tiingo.com/iex/${symbol}/prices?startDate=${fromStr}&endDate=${toStr}&resampleFreq=${tiingoInterval}&token=${TIINGO_TOKEN}`;
    console.log(`[Tiingo] 请求 URL: ${url.replace(TIINGO_TOKEN!, 'HIDDEN')}`);

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    console.log(`[Tiingo] 响应状态: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Tiingo] HTTP 错误 ${response.status}: ${errorText}`);
      return null; // 改为返回 null 而不是抛出异常，避免中断流程
    }

    const data = await response.json();
    console.log(`[Tiingo] 收到 ${data.length} 条原始数据`);

    if (!Array.isArray(data) || data.length === 0) {
      console.warn(`[Tiingo] 数据为空或非数组，data:`, JSON.stringify(data).substring(0, 200));
      return null;
    }

    const ohlcv = data.map((item: any) => ({
      timestamp: Math.floor(new Date(item.date).getTime() / 1000),
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volume,
    }));

    console.log(`[Tiingo] 成功构建 ${ohlcv.length} 条 OHLCV 数据，第一条日期: ${new Date(ohlcv[0].timestamp * 1000).toISOString()}`);
    // Tiingo 返回的数据通常是升序（旧到新）
    return ohlcv;
  } catch (error) {
    console.error(`[Tiingo] 捕获异常:`, error);
    return null;
  }
}

/**
 * 从 Tiingo 获取股票日线历史数据（支持增量拉取）
 * @param symbol 股票代码，如 "AAPL"
 * @param sinceDate 可选，起始日期 (YYYY-MM-DD)，只拉取该日期之后的数据
 * @returns OHLCV 数组，按时间升序
 */
export async function fetchTiingoDailyHistory(
  symbol: string,
  sinceDate?: string
): Promise<{ timestamp: number; open: number; high: number; low: number; close: number; volume: number }[] | null> {
  await tiingoRateLimiter.waitForSlot(); // 新增速率限制
  console.log(`[Tiingo] 开始 fetchTiingoDailyHistory: symbol=${symbol}, sinceDate=${sinceDate}`);

  try {
    const toDate = new Date();
    let fromDate: Date;
    if (sinceDate) {
      fromDate = new Date(sinceDate);
      console.log(`[Tiingo] 使用 sinceDate: ${fromDate.toISOString()}`);
    } else {
      // 默认拉取过去 30 年
      fromDate = new Date();
      fromDate.setFullYear(fromDate.getFullYear() - 30);
      console.log(`[Tiingo] 无 sinceDate，拉取过去 30 年: ${fromDate.toISOString()}`);
    }

    const fromStr = fromDate.toISOString().split('T')[0];
    const toStr = toDate.toISOString().split('T')[0];

    const url = `https://api.tiingo.com/tiingo/daily/${symbol}/prices?startDate=${fromStr}&endDate=${toStr}&token=${TIINGO_TOKEN}`;
    console.log(`[Tiingo] 请求 URL: ${url.replace(TIINGO_TOKEN!, 'HIDDEN')}`);

    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
    });
    console.log(`[Tiingo] 响应状态: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Tiingo] HTTP 错误 ${response.status}: ${errorText}`);
      return null; // 改为返回 null
    }

    const data = await response.json();
    console.log(`[Tiingo] 收到 ${data.length} 条原始数据`);

    if (!Array.isArray(data) || data.length === 0) {
      console.warn(`[Tiingo] 数据为空`);
      return null;
    }

    const ohlcv = data.map((item: any) => ({
      timestamp: Math.floor(new Date(item.date).getTime() / 1000),
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volume,
    }));

    console.log(`[Tiingo] 成功构建 ${ohlcv.length} 条日线数据，第一条日期: ${new Date(ohlcv[0].timestamp * 1000).toISOString()}`);
    return ohlcv; // Tiingo 默认升序
  } catch (error) {
    console.error(`[Tiingo] 捕获异常:`, error);
    return null;
  }
}