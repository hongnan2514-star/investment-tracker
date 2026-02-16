import { DataSourceResult, UnifiedAsset } from "./types";

const ITICK_TOKEN = process.env.ITICK_TOKEN;

export async function queryITick(symbol: string): Promise<DataSourceResult> {
    if (!ITICK_TOKEN) {
        return { success: false, data: null, error: 'iTick token not configured', source: 'iTick' };
    }

    try {
        // iTick API示例(请根据实际文档调整)
        const url = `https://api.itick.com/v1/quote?symbol=${symbol}&token=${ITICK_TOKEN}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.code !== 0 || !data.data)
        {
            return { success: false, data: null, error: data.msg || 'No data from iTick', source: 'iTick' };
        }

        const quote = data.data;
        const asset: UnifiedAsset = {
            symbol: quote.symbol,
            name: quote.name || symbol,
            price: quote.price,
            changePercent: quote.change_percent,
            currency: quote.currency || 'CNY',
            market: quote.exchange,
            type: quote.type === 'etf' ? 'etf' : 'stock',
            source: 'iTick',
            lastUpdated: new Date().toISOString()
        };

        return { success: true , data: asset, source: 'iTick' };
    } catch (error: any) {
        return { success: false, data: null, error: error.message, source: 'iTick' };
    }
}