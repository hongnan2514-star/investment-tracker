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