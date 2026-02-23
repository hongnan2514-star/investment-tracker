import { NextRequest, NextResponse } from 'next/server';
import { needsStockUpdate, saveStockHistory } from '@/src/services/fundHistoryDB';
import { needsCryptoUpdate, saveCryptoHistory } from '@/src/services/fundHistoryDB';
import { queryCryptoHistory } from '@/app/api/data-sources/crypto-ccxt';

async function updateStockHistory(symbol: string): Promise<{ updated: boolean; count?: number }> {
  try {
    if (!needsStockUpdate(symbol)) return { updated: false };

    const apiKey = process.env.ALPHA_VANTAGE_KEY;
    if (!apiKey) {
      console.warn('缺少 Alpha Vantage API Key');
      return { updated: false };
    }

    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${symbol}&apikey=${apiKey}&outputsize=compact`;
    const res = await fetch(url);
    const data = await res.json();

    if (data['Error Message'] || data['Note'] || !data['Time Series (Daily)']) {
      console.warn(`获取股票历史失败 ${symbol}:`, data['Note'] || data['Error Message']);
      return { updated: false };
    }

    const timeSeries = data['Time Series (Daily)'];
    const stockPrices: any[] = [];
    for (const [date, values] of Object.entries(timeSeries)) {
      const v: any = values;
      stockPrices.push({
        symbol,
        date,
        open: parseFloat(v['1. open']),
        high: parseFloat(v['2. high']),
        low: parseFloat(v['3. low']),
        close: parseFloat(v['4. close']),
        volume: parseInt(v['6. volume'], 10)
      });
    }
    saveStockHistory(stockPrices);
    console.log(`[历史更新] 股票 ${symbol} 历史数据已保存 (${stockPrices.length}条)`);
    return { updated: true, count: stockPrices.length };
  } catch (error) {
    console.error(`更新股票历史失败 ${symbol}:`, error);
    return { updated: false };
  }
}

async function updateCryptoHistory(baseSymbol: string): Promise<{ updated: boolean; count?: number }> {
  try {
    if (!needsCryptoUpdate(baseSymbol)) return { updated: false };

    const history = await queryCryptoHistory(baseSymbol, 365);
    if (!history || history.length === 0) {
      console.warn(`获取加密货币历史失败: ${baseSymbol}`);
      return { updated: false };
    }

    const records = history.map(item => ({
      symbol: `${baseSymbol}/USDT`,
      date: item.date,
      open: item.close,
      high: item.close,
      low: item.close,
      close: item.close,
      volume: 0,
    }));
    saveCryptoHistory(records);
    console.log(`[历史更新] 加密货币 ${baseSymbol} 历史数据已保存 (${records.length}条)`);
    return { updated: true, count: records.length };
  } catch (error) {
    console.error(`更新加密货币历史失败 ${baseSymbol}:`, error);
    return { updated: false };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { asset } = await request.json();
    const { type, symbol } = asset;

    let result;
    if (type === 'stock' || type === 'etf') {
      result = await updateStockHistory(symbol);
    } else if (type === 'crypto') {
      // 从资产符号中提取基础币种（例如 "BTC/USDT" 取 "BTC"）
      const baseSymbol = symbol.split('/')[0];
      result = await updateCryptoHistory(baseSymbol);
    } else {
      return NextResponse.json({ success: false, error: '不支持的资产类型' }, { status: 400 });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('历史更新API错误:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}