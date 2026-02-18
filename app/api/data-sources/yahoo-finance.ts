// /app/api/data-sources/yahoo-finance.ts
import { DataSourceResult, UnifiedAsset } from "./types";
import { fetchWithTimeout } from "./_untils";

export async function queryYahooFinance(symbol: string): Promise<DataSourceResult> {
    try {
        // 使用 yahoo-finance2 库的API(无需安装, 直接调用其公开端点)
        // 注意: 这是非官方API, 可能随时变化
        const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d`;
        const response = await fetchWithTimeout(url, 2500);
        const data = await response.json();

        // 检查响应结构是否正确
        if (!data.chart?.result?.[0]?.meta) {
            return { success: false, 
                     data: null, 
                     error: 'No data from Yahoo', 
                     source: 'Yahoo Finance' };
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
            raw: meta // 保留原始数据用于调试
        };

        return { success: true, data: asset, source: 'Yahoo Finance' };
    } catch (error: any) {
        return { success: false, 
                 data: null, 
                 error: error.message, 
                 source: 'Yahoo Finance'}
    }
}