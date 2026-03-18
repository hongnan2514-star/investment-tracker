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
import { fetchYahooHistory } from '../../data-sources/yahoo-finance';
import { fetchCryptoDailyHistory } from '../../data-sources/crypto-ccxt';
import { StockPrice } from '@/src/services/fundHistoryDB';

// 更新队列，只用于串行化，不关心返回值类型
let updateQueue = Promise.resolve() as Promise<void>;

async function enqueueUpdate<T>(fn: () => Promise<T>): Promise<T> {
  const resultPromise = updateQueue.then(fn);
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

      // 3. 先尝试 Tiingo
      const tiingoData = await fetchTiingoDailyHistory(symbol, sinceDate);
      let freshData: StockPrice[] | null = null;
      if (tiingoData && tiingoData.length > 0) {
        freshData = tiingoData.map(item => ({
          symbol,
          date: new Date(item.timestamp * 1000).toISOString().split('T')[0],
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close,
          volume: item.volume,
        }));
      } else {
        // Tiingo 失败，判断是否为 A股或港股（需要雅虎后备）
        const isAStock = symbol.includes('.SS') || symbol.includes('.SZ');
        const isHKStock = symbol.includes('.HK') || /^\d{4,5}$/.test(symbol);
        if (isAStock || isHKStock) {
          console.log(`[历史更新] Tiingo 获取日线失败，尝试雅虎后备: ${symbol}`);
          const yahooData = await fetchYahooHistory(symbol, 365 * 5);
          if (yahooData && yahooData.length > 0) {
            if (sinceDate) {
              const sinceTimestamp = new Date(sinceDate).getTime();
              freshData = yahooData.filter(item => new Date(item.date).getTime() >= sinceTimestamp);
            } else {
              freshData = yahooData;
            }
          }
        } else {
          // 美股等其他市场，不尝试雅虎后备
          console.log(`[历史更新] ${symbol} 不是A股/港股，Tiingo 失败后不再尝试`);
        }
      }

      if (!freshData || freshData.length === 0) {
        console.warn(`[历史更新] 所有数据源均无法获取股票 ${symbol} 日线数据`);
        return { updated: false };
      }

      // 4. 保存到数据库
      await saveStockHistory(freshData);
      console.log(`[历史更新] 股票 ${symbol} 历史数据已保存 (${freshData.length}条)`);
      return { updated: true, count: freshData.length };
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