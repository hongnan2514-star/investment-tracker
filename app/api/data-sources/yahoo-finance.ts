// /app/api/data-sources/yahoo-finance.ts
import { DataSourceResult, UnifiedAsset } from "./types";
import { fetchWithTimeout } from "./_untils";
import { StockPrice } from '@/src/services/fundHistoryDB';

export async function queryYahooFinance(symbol: string): Promise<DataSourceResult> {
    try {
        const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d`;
        const response = await fetchWithTimeout(url, 2500);
        const data = await response.json();

        if (!data.chart?.result?.[0]?.meta) {
            return { success: false, data: null, error: 'No data from Yahoo', source: 'Yahoo Finance' };
        }

        const result = data.chart.result[0];
        const meta = result.meta;

        const asset: UnifiedAsset = {
            symbol: meta.symbol,
            name: meta.longName || meta.shortName || symbol,
            price: meta.regularMarketPrice,
            changePercent: (meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose * 100,
            currency: meta.currency,
            market: meta.fullExchangeName,
            type: meta.instrumentType === 'ETF' ? 'etf' : 'stock',
            source: 'Yahoo Finance',
            lastUpdated: new Date().toISOString(),
            raw: meta
        };

        return { success: true, data: asset, source: 'Yahoo Finance' };
    } catch (error: any) {
        return { success: false, data: null, error: error.message, source: 'Yahoo Finance' };
    }
}

/**
 * 从 Yahoo Finance 获取股票历史 K 线数据
 * @param symbol 股票代码，如 AAPL
 * @param days 需要获取的天数，默认365
 * @returns StockPrice 数组，如果失败返回 null
 */
export async function fetchYahooHistory(symbol: string, days: number = 365): Promise<StockPrice[] | null> {
    try {
        const to = Math.floor(Date.now() / 1000);
        const from = to - days * 24 * 60 * 60;

        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&period1=${from}&period2=${to}`;
        const response = await fetchWithTimeout(url, 10000);
        const data = await response.json();

        if (!data.chart?.result?.[0]) {
            console.warn(`Yahoo历史数据获取失败: ${symbol}`, data);
            return null;
        }

        const result = data.chart.result[0];
        const timestamps: number[] = result.timestamp;
        const quotes = result.indicators?.quote?.[0];
        if (!timestamps || !quotes) return null;

        const stockPrices: StockPrice[] = [];
        for (let i = 0; i < timestamps.length; i++) {
            const open = quotes.open?.[i];
            const high = quotes.high?.[i];
            const low = quotes.low?.[i];
            const close = quotes.close?.[i];
            const volume = quotes.volume?.[i];

            if (open == null || high == null || low == null || close == null || volume == null) continue;

            stockPrices.push({
                symbol,
                date: new Date(timestamps[i] * 1000).toISOString().split('T')[0],
                open,
                high,
                low,
                close,
                volume,
            });
        }

        return stockPrices.length > 0 ? stockPrices : null;
    } catch (error) {
        console.error(`Yahoo历史数据请求失败 ${symbol}:`, error);
        return null;
    }
}

/**
 * 从 Yahoo Finance 获取股票分钟级 OHLCV 数据（支持增量拉取）
 * @param symbol 股票代码，如 "AAPL"
 * @param interval 时间粒度，如 '15m', '1h', '6h'（Yahoo 支持的间隔：1m,2m,5m,15m,30m,60m,1d,5d,1wk,1mo,3mo）
 * @param limit 当 since 未提供时，拉取的最大条数
 * @param sinceTimestamp 可选，起始时间戳（毫秒），只拉取此时间之后的数据
 */
export async function fetchStockMinuteData(
  symbol: string,
  interval: string = '15m',
  limit: number = 200,
  sinceTimestamp?: number
): Promise<{ timestamp: number; open: number; high: number; low: number; close: number; volume: number }[] | null> {
  try {
    const to = Math.floor(Date.now() / 1000);
    let from: number;
    if (sinceTimestamp) {
      from = Math.floor(sinceTimestamp / 1000); // 毫秒转秒
    } else {
      // 根据 limit 和 interval 估算起始时间
      const intervalSeconds: Record<string, number> = {
        '1m': 60, '2m': 120, '5m': 300, '15m': 900, '30m': 1800, '60m': 3600,
        '1h': 3600, '6h': 21600, '1d': 86400,
      };
      const secs = intervalSeconds[interval] || 900;
      from = to - limit * secs;
    }

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&period1=${from}&period2=${to}`;
    console.log(`[Yahoo] 请求分钟数据: ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (!data.chart?.result?.[0]) {
      console.warn(`[Yahoo] 无数据: ${symbol}`, data);
      return null;
    }

    const result = data.chart.result[0];
    const timestamps: number[] = result.timestamp;
    const quotes = result.indicators?.quote?.[0];
    if (!timestamps || !quotes) return null;

    const ohlcv: { timestamp: number; open: number; high: number; low: number; close: number; volume: number }[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const open = quotes.open?.[i];
      const high = quotes.high?.[i];
      const low = quotes.low?.[i];
      const close = quotes.close?.[i];
      const volume = quotes.volume?.[i];
      if (open == null || high == null || low == null || close == null || volume == null) continue;
      ohlcv.push({
        timestamp: timestamps[i],
        open,
        high,
        low,
        close,
        volume,
      });
    }

    return ohlcv.length > 0 ? ohlcv : null;
  } catch (error) {
    console.error(`[Yahoo] 获取分钟数据失败 ${symbol}:`, error);
    return null;
  }
}