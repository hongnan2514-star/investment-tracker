// app/api/history/update/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  needsStockDailyUpdate,
  getLatestStockDate,
  saveStockHistory,
  needsCryptoDailyUpdate,
  getLatestCryptoDate,
  saveCryptoHistory,
} from '@/src/services/fundHistoryDB';
import { fetchTiingoDailyHistory } from '../../data-sources/tiingo-stock';
import { fetchCryptoDailyHistory } from '../../data-sources/crypto-ccxt';

// 更新队列，只用于串行化，不关心返回值类型
let updateQueue = Promise.resolve() as Promise<void>;

async function enqueueUpdate<T>(fn: () => Promise<T>): Promise<T> {
  // 等待当前队列完成，然后执行新任务，返回其结果
  const resultPromise = updateQueue.then(fn);
  // 更新队列为忽略结果的新 Promise（仅用于串行化）
  updateQueue = resultPromise.then(() => {}).catch(() => {});
  return resultPromise;
}

async function updateStockHistory(symbol: string): Promise<{ updated: boolean; count?: number }> {
  return enqueueUpdate(async () => {
    try {
      // 1. 检查是否需要更新（今天是否已更新）
      const needsUpdate = await needsStockDailyUpdate(symbol);
      if (!needsUpdate) {
        console.log(`[历史更新] 股票 ${symbol} 数据已最新，跳过更新`);
        return { updated: false };
      }

      // 2. 获取最新日期，计算增量起始日期
      const lastDateStr = await getLatestStockDate(symbol);
      let sinceDate: string | undefined;
      if (lastDateStr) {
        const nextDay = new Date(lastDateStr);
        nextDay.setDate(nextDay.getDate() + 1);
        sinceDate = nextDay.toISOString().split('T')[0];
        console.log(`[历史更新] 股票 ${symbol} 最新日期=${lastDateStr}, 增量起始=${sinceDate}`);
      } else {
        console.log(`[历史更新] 股票 ${symbol} 无历史数据，将拉取全量`);
      }

      // 3. 从 Tiingo 拉取增量数据
      const freshData = await fetchTiingoDailyHistory(symbol, sinceDate);
      if (!freshData || freshData.length === 0) {
        console.warn(`[历史更新] 获取股票 ${symbol} 日线数据失败`);
        return { updated: false };
      }

      // 4. 转换为 StockPrice 格式并保存
      const records = freshData.map(item => ({
        symbol,
        date: new Date(item.timestamp * 1000).toISOString().split('T')[0],
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
        volume: item.volume,
      }));
      await saveStockHistory(records);
      console.log(`[历史更新] 股票 ${symbol} 历史数据已保存 (${records.length}条)`);
      return { updated: true, count: records.length };
    } catch (error) {
      console.error(`[历史更新] 更新股票 ${symbol} 失败:`, error);
      return { updated: false };
    }
  });
}

async function updateCryptoHistory(baseSymbol: string): Promise<{ updated: boolean; count?: number }> {
  return enqueueUpdate(async () => {
    try {
      const symbol = `${baseSymbol}/USDT`;
      console.log(`[updateCryptoHistory] 开始处理 ${symbol}`);

      const needsUpdate = await needsCryptoDailyUpdate(symbol);
      console.log(`[updateCryptoHistory] needsUpdate=${needsUpdate}`);

      if (!needsUpdate) {
        console.log(`[历史更新] ${baseSymbol} 数据已最新，跳过更新`);
        return { updated: false };
      }

      const lastDateStr = await getLatestCryptoDate(symbol);
      console.log(`[updateCryptoHistory] getLatestCryptoDate 返回: ${lastDateStr}`);

      let sinceTimestamp: number | undefined;
      if (lastDateStr) {
        const [year, month, day] = lastDateStr.split('-').map(Number);
        const nextDayUTC = Date.UTC(year, month - 1, day + 1);
        sinceTimestamp = nextDayUTC;
        console.log(`[历史更新] ${baseSymbol} 最新日期=${lastDateStr}, 增量起始=${new Date(sinceTimestamp).toISOString()}`);
      } else {
        console.log(`[历史更新] ${baseSymbol} 无历史数据，将拉取全量`);
      }

      console.log(`[updateCryptoHistory] 开始调用 fetchCryptoDailyHistory, sinceTimestamp=${sinceTimestamp}`);
      const dailyData = await fetchCryptoDailyHistory(baseSymbol, sinceTimestamp);
      console.log(`[updateCryptoHistory] fetchCryptoDailyHistory 返回条数: ${dailyData?.length}`);

      if (!dailyData || dailyData.length === 0) {
        console.warn(`[历史更新] 获取 ${baseSymbol} 历史数据失败`);
        return { updated: false };
      }

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
  });
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