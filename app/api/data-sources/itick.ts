// /app/api/data-sources/itick.ts
import { DataSourceResult, UnifiedAsset } from "./types";

const ITICK_TOKEN = process.env.ITICK_TOKEN;

export async function queryITick(symbol: string): Promise<DataSourceResult> {
    if (!ITICK_TOKEN) {
        return { success: false, data: null, error: 'iTick token not configured', source: 'iTick' };
    }

    try {
        const url = `https://api.itick.com/v1/quote?symbol=${symbol}&token=${ITICK_TOKEN}`;
        console.log(`[iTick] 请求URL: ${url}`);
        const response = await fetch(url);
        const data = await response.json();
        console.log(`[iTick] 响应:`, JSON.stringify(data).substring(0, 200));

        if (data.code !== 0 || !data.data) {
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

        return { success: true, data: asset, source: 'iTick' };
    } catch (error: any) {
        console.error('[iTick] 股票查询异常:', error);
        return { success: false, data: null, error: error.message, source: 'iTick' };
    }
}

export async function queryITickMetal(code: string): Promise<DataSourceResult> {
    if (!ITICK_TOKEN) {
        return { success: false, data: null, error: 'iTick token not configured', source: 'iTick' };
    }

    try {
        // 映射常见纯度代码到国际代码（交易对）
        const metalMap: Record<string, string> = {
            'Au999': 'XAUUSD',
            'Ag999': 'XAGUSD',
            '黄金': 'XAUUSD',
            '白银': 'XAGUSD',
            'XAU': 'XAUUSD',
            'XAG': 'XAGUSD',
        };
        const symbol = metalMap[code] || code; // 例如 XAUUSD

        // 使用正确的域名 api.itick.org，并将 token 放在 Authorization header 中
        const url = `https://api.itick.org/forex/tick?code=${symbol}`;
        console.log(`[iTick金属] 请求URL: ${url}`);
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${ITICK_TOKEN}`
            }
        });
        
        const text = await response.text();
        console.log(`[iTick金属] 原始响应: ${text.substring(0, 200)}`);

        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            return { success: false, data: null, error: 'Invalid JSON from iTick', source: 'iTick' };
        }

        // 根据实际返回结构调整，假设返回字段包含 lastPrice, changePercent 等
        if (!data || data.lastPrice === undefined) {
            return { success: false, data: null, error: 'Invalid response from iTick', source: 'iTick' };
        }

        const asset: UnifiedAsset = {
            symbol: code,
            name: code === 'Au999' ? '黄金 (Au999)' : code === 'Ag999' ? '白银 (Ag999)' : `贵金属 (${code})`,
            price: data.lastPrice,
            changePercent: data.changePercent || 0,
            currency: 'USD',
            market: '国际现货',
            type: 'metal',
            source: 'iTick',
            lastUpdated: new Date().toISOString(),
            metadata: {
                high: data.high,
                low: data.low,
                volume: data.volume,
            }
        };

        return { success: true, data: asset, source: 'iTick' };
    } catch (error: any) {
        console.error('[iTick金属] 查询异常:', error);
        return { success: false, data: null, error: error.message, source: 'iTick' };
    }
}