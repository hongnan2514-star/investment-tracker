import { DataSourceResult, UnifiedAsset } from "./types";

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;

export async function queryFinnhub(symbol: string): Promise<DataSourceResult> {
  try {
    // 1. 获取实时报价
    const quoteRes = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`
    );
    const quote = await quoteRes.json();

    // 2. 获取公司基本信息（名称）
    const profileRes = await fetch(
      `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB_API_KEY}`
    );
    const profile = await profileRes.json();

    // 检查返回数据是否有效
    if (!quote || quote.error || !profile || !profile.name) {
      return {
        success: false,
        data: null,
        error: `Finnhub 未找到 ${symbol} 的数据`,
        source: 'Finnhub',
      };
    }

    const asset: UnifiedAsset = {
      symbol: symbol,
      name: profile.name,
      price: quote.c,          // 当前价
      changePercent: quote.dp, // 涨跌幅百分比
      currency: 'USD',
      market: 'US',
      type: 'stock',
      source: 'Finnhub',
      lastUpdated: new Date().toISOString(),
    };

    return { success: true, data: asset, source: 'Finnhub' };
  } catch (error: any) {
    return {
      success: false,
      data: null,
      error: error.message,
      source: 'Finnhub',
    };
  }
}