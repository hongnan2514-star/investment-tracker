// app/api/history/update/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { needsStockUpdate, saveStockHistory, needsCryptoDailyUpdate, getLatestCryptoDate, saveCryptoHistory } from '@/src/services/fundHistoryDB';
import { fetchYahooHistory } from '@/app/api/data-sources/yahoo-finance';
import { fetchCryptoDailyHistory } from '../../data-sources/crypto-ccxt';

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
    const symbol = `${baseSymbol}/USDT`;
    // 检查是否需要更新（根据最新日期是否早于今天）
    const needsUpdate = await needsCryptoDailyUpdate(symbol);
    if (!needsUpdate) {
      console.log(`[历史更新] ${baseSymbol} 数据已最新，跳过更新`);
      return { updated: false };
    }

    // 获取最新日期，用于计算增量起始时间
    const lastDateStr = await getLatestCryptoDate(symbol);
    let sinceTimestamp: number | undefined;
    if (lastDateStr) {
      const [year, month, day] = lastDateStr.split('-').map(Number);
      const nextDayUTC = Date.UTC(year, month - 1, day + 1);
      sinceTimestamp = nextDayUTC;
      console.log(`[历史更新] ${baseSymbol} 最新日期=${lastDateStr}, 增量起始=${new Date(sinceTimestamp).toISOString()}`);
    } else {
      console.log(`[历史更新] ${baseSymbol} 无历史数据，将拉取全量`);
    }

    // 调用 fetchCryptoDailyHistory 拉取数据（全量或增量）
    const dailyData = await fetchCryptoDailyHistory(baseSymbol, sinceTimestamp);
    if (!dailyData || dailyData.length === 0) {
      console.warn(`[历史更新] 获取 ${baseSymbol} 历史数据失败`);
      return { updated: false };
    }

    // 转换为 CryptoPrice 格式并保存
    const records = dailyData.map(item => ({
      symbol,
      date: new Date(item.timestamp * 1000).toISOString().split('T')[0],
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volume,
    }));

    await saveCryptoHistory(records);
    console.log(`[历史更新] 加密货币 ${baseSymbol} 历史数据已保存 (${records.length}条)`);
    return { updated: true, count: records.length };
  } catch (error) {
    console.error(`[历史更新] 更新 ${baseSymbol} 失败:`, error);
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

export { updateStockHistory };