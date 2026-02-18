// /app/api/data-sources/alpha-vantage.ts
import { error } from "console";
import { DataSourceResult, UnifiedAsset } from "./types";
import { fetchWithTimeout } from "./_untils";

const API_KEY = process.env.ALPHA_VANTAGE_KEY;

export async function queryAlphaVantage(symbol: string): Promise<DataSourceResult> {
    if (!API_KEY) {
        return { success: false, data: null, error: 'API key not configured', source: 'Alpha Vantage'
        };
    }

    try {
        // 先尝试搜索, 获取名称等信息
        const searchUrl = `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${symbol}&apikey=${API_KEY}`;
        const searchRes = await fetchWithTimeout(searchUrl, 2500);
        const searchData = await searchRes.json();

        let name = symbol;
        let currency = 'USD'

        if (searchData.bestMatches?.[0]) {
            const match = searchData.bestMatches[0];
            name = match['2. name'];
            currency = match['8. currency'];
        }

        // 然后获取报价
        const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`;
        const quoteRes = await fetchWithTimeout(quoteUrl, 2500);
        const quoteData = await quoteRes.json();

        if (quoteData['Global Quote']) {
            const quote = quoteData['Global Quote'];
            const asset: UnifiedAsset = {
                symbol: quote['01. symbol'] || symbol, name,
                price: parseFloat(quote['05. price']),
                changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
                currency,
                market: 'US', //简化处理, 实际应从数据提取
                type: 'stock',
                source: 'Alpha Vantage',
                lastUpdated: new Date().toISOString()
            };
            return {
                success: true, data: asset, source: 'Alpha Vantage'
            };
        } 
        return { success: false, data: null, error: 'No quote data', source: 'Alpha Vantage' };
    } catch (error: any) {
        return { success: false, data: null, error: error.message, source: 'Alpha Vantage'};
    }
}