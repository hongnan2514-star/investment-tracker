// app/api/history/update/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { needsStockUpdate, saveStockHistory, StockPrice } from '@/src/services/fundHistoryDB';
import { needsCryptoUpdate, saveCryptoHistory } from '@/src/services/fundHistoryDB';
import { queryCryptoHistory } from '@/app/api/data-sources/crypto-ccxt';
import { fetchYahooHistory } from '@/app/api/data-sources/yahoo-finance';

async function updateStockHistory(symbol: string): Promise<{ updated: boolean; count?: number }> {
  try {
    if (!(await needsStockUpdate(symbol))) return { updated: false };

    const stockPrices = await fetchYahooHistory(symbol, 365);
    if (!stockPrices || stockPrices.length === 0) {
      console.warn(`获取股票历史失败 ${symbol}: 无数据`);
      return { updated: false };
    }

    await saveStockHistory(stockPrices);
    console.log(`[历史更新] 股票 ${symbol} 历史数据已保存 (${stockPrices.length}条)`);
    return { updated: true, count: stockPrices.length };
  } catch (error) {
    console.error(`更新股票历史失败 ${symbol}:`, error);
    return { updated: false };
  }
}

async function updateCryptoHistory(baseSymbol: string): Promise<{ updated: boolean; count?: number }> {
  try {
    if (!(await needsCryptoUpdate(baseSymbol))) return { updated: false };

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
    await saveCryptoHistory(records);
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