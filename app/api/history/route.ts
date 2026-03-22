// app/api/history/route.ts
import { NextRequest, NextResponse } from 'next/server';

// 临时绕过所有业务逻辑，直接返回空数据，用于排查 401 问题
export async function GET(request: NextRequest) {
  // 检查是否为内部调用（由 snapshot/history 发起）
  const internal = request.nextUrl.searchParams.get('internal') === 'true';
  // 如果内部调用，也返回空数据（测试用）
  console.log(`[历史API] 临时测试模式，internal=${internal}`);
  
  // 直接返回空数据，绕过所有数据库查询和外部API调用
  return NextResponse.json({ success: true, data: [] });
}

// 原有业务逻辑已全部注释，待问题解决后恢复
/*
import { 
  getFundHistory, 
  getCryptoMinuteHistory, 
  getStockHistory,
  saveCryptoHistory,
  getCryptoHistorySince,
  needsCryptoDailyUpdate,
  getLatestCryptoDate,
  saveCryptoMinute, 
  needsStockMinuteUpdate,
  getStockMinuteHistory,
  saveStockMinute,
  getStockMonthlyHistory,
  getCryptoMonthlyHistory,
  needsStockDailyUpdate,
  getLatestStockDate,
  saveStockHistory,
  getStockHistorySince,
  getFundHistorySince,
  saveFundHistory,
} from '@/src/services/fundHistoryDB';
import { fetchCryptoMinuteData, fetchCryptoDailyHistory, } from '../data-sources/crypto-ccxt';
import { fetchTiingoMinuteData } from '../data-sources/tiingo-stock';
import { fetchAStockMinuteDataFromSina } from '../data-sources/sina-stock';
import { fetchTiingoDailyHistory } from '../data-sources/tiingo-stock';
import { fetchStockMinuteData } from '../data-sources/yahoo-finance';
import { fetchFundHistoryFromEastMoney } from '../data-sources/eastmoney-fund';
import { fetchYahooHistory } from '../data-sources/yahoo-finance';
import { StockPrice } from '@/src/services/fundHistoryDB';

const timeframeSeconds: Record<string, number> = {
  '15m': 15 * 60,
  '30m': 30 * 60,
  '1h': 60 * 60,
  '4h': 4 * 60 * 60,
  '6h': 6 * 60 * 60,
};

const rangeToResolution: Record<string, string> = {
  '15m': '15m',
  '1d': '1h',
  '1M': '6h',
};

function isDataStale(lastTimestamp: number | null, resolution: string): boolean {
  if (!lastTimestamp) return true;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const ageSeconds = nowSeconds - lastTimestamp;
  const maxAgeMap: Record<string, number> = {
    '15m': 15 * 60,
    '30m': 30 * 60,
    '1h': 60 * 60,
    '6h': 6 * 60 * 60,
  };
  const maxAge = maxAgeMap[resolution] || 30 * 60;
  return ageSeconds > maxAge;
}

function isOverFiveYears(startDateStr: string): boolean {
  const start = new Date(startDateStr);
  const now = new Date();
  const diffTime = now.getTime() - start.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  return diffDays > 5 * 365;
}

async function fetchStockDailyWithFallback(symbol: string, sinceDate?: string): Promise<StockPrice[] | null> {
  // 先尝试 Tiingo
  const tiingoData = await fetchTiingoDailyHistory(symbol, sinceDate);
  if (tiingoData && tiingoData.length > 0) {
    return tiingoData.map(item => ({
      symbol,
      date: new Date(item.timestamp * 1000).toISOString().split('T')[0],
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volume,
    }));
  }
  console.log(`[历史API] Tiingo 获取日线失败，尝试雅虎后备: ${symbol}`);
  const yahooData = await fetchYahooHistory(symbol, 365 * 5);
  if (yahooData && yahooData.length > 0) {
    if (sinceDate) {
      const sinceTimestamp = new Date(sinceDate).getTime();
      return yahooData.filter(item => new Date(item.date).getTime() >= sinceTimestamp);
    }
    return yahooData;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const internal = request.nextUrl.searchParams.get('internal') === 'true';
  const symbol = request.nextUrl.searchParams.get('symbol');
  const type = request.nextUrl.searchParams.get('type');
  const rawRange = request.nextUrl.searchParams.get('range') || '1d';
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '365');

  if (!symbol || !type) {
    return NextResponse.json({ error: '缺少参数' }, { status: 400 });
  }

  let range = rawRange;
  if (range === '1日') range = '15m';
  else if (range === '1周') range = '1d';
  else if (range === '1月') range = '1M';
  else if (range === '持有以来') range = 'since_holding';

  console.log(`[历史API] 原始range=${rawRange}, 标准化后=${range}`);

  try {
    let history: { date: string; value: number }[] = [];

    if (type === 'fund') {
      const cleanCode = symbol.replace(/\.OF$/, '');
      console.time(`[性能] 基金 ${cleanCode} ${range}`);
      if (range === 'since_holding') {
        const startDate = request.nextUrl.searchParams.get('startDate');
        if (!startDate) {
          return NextResponse.json({ error: '缺少 startDate 参数' }, { status: 400 });
        }
        const fundHistory = await getFundHistorySince(cleanCode, startDate);
        history = fundHistory.map(item => ({ date: item.date, value: item.nav }));
      } else {
        let dbHistory = await getFundHistory(cleanCode, limit);
        if (dbHistory.length < limit) {
          console.log(`[历史API] 基金 ${cleanCode} 历史数据不足 (${dbHistory.length}/${limit})，尝试从天天基金拉取全量历史`);
          const fullHistory = await fetchFundHistoryFromEastMoney(cleanCode);
          if (fullHistory && fullHistory.length > 0) {
            await saveFundHistory(fullHistory);
            console.log(`[历史API] 基金 ${cleanCode} 全量历史已保存，共 ${fullHistory.length} 条`);
            dbHistory = await getFundHistory(cleanCode, limit);
          } else {
            console.warn(`[历史API] 从天天基金拉取基金 ${cleanCode} 全量历史失败`);
          }
        }
        history = dbHistory.map(item => ({ date: item.date, value: item.nav }));
      }
      console.timeEnd(`[性能] 基金 ${cleanCode} ${range}`);
    } else if (type === 'stock' || type === 'etf') {
      // 处理日线数据（包括 since_holding 和 1d_hk）
      if (range === 'since_holding' || range === '1d_hk' || range === '1d_a') {
        if (range === 'since_holding') {
          const startDate = request.nextUrl.searchParams.get('startDate');
          if (!startDate) {
            return NextResponse.json({ error: '缺少 startDate 参数' }, { status: 400 });
          }
          console.log(`[历史API] 股票 since_holding: symbol=${symbol}, startDate=${startDate}`);
          if (isOverFiveYears(startDate)) {
            console.log(`[历史API] 买入日期超过5年，使用月线数据`);
            const monthlyData = await getStockMonthlyHistory(symbol, startDate);
            history = monthlyData.map(item => ({ date: item.date, value: item.close }));
          } else {
            console.log(`[历史API] 买入日期5年以内，使用日线数据`);
            const needsDailyUpdate = await needsStockDailyUpdate(symbol);
            console.log(`[历史API] 股票 needsDailyUpdate = ${needsDailyUpdate}`);
            if (needsDailyUpdate) {
              console.log(`[历史API] 股票日线数据陈旧，触发增量更新`);
              const lastDateStr = await getLatestStockDate(symbol);
              console.log(`[历史API] 数据库中最新的日期: ${lastDateStr}`);
              let sinceDate: string | undefined;
              if (lastDateStr) {
                const nextDay = new Date(lastDateStr);
                nextDay.setDate(nextDay.getDate() + 1);
                sinceDate = nextDay.toISOString().split('T')[0];
                console.log(`[历史API] 计算的 sinceDate = ${sinceDate}`);
              } else {
                console.log(`[历史API] 无历史数据，将拉取全量`);
              }
              const freshDaily = await fetchStockDailyWithFallback(symbol, sinceDate);
              if (freshDaily && freshDaily.length > 0) {
                await saveStockHistory(freshDaily);
                console.log(`[历史API] 已保存 ${freshDaily.length} 条股票日线数据`);
              }
            }
            const stockHistory = await getStockHistorySince(symbol, startDate);
            history = stockHistory.map(item => ({ date: item.date, value: item.close }));
          }
        } else {
          console.log(`[历史API] 月线日线请求，获取最近 ${limit} 条日线数据`);
          let stockHistory = await getStockHistory(symbol, limit);
          if (stockHistory.length === 0) {
            console.log(`[历史API] 股票 ${symbol} 数据库中无日线数据，尝试从雅虎拉取`);
            const yahooData = await fetchYahooHistory(symbol, limit * 2);
            if (yahooData && yahooData.length > 0) {
              await saveStockHistory(yahooData);
              console.log(`[历史API] 已从雅虎保存 ${yahooData.length} 条日线数据`);
              stockHistory = await getStockHistory(symbol, limit);
            } else {
              console.warn(`[历史API] 雅虎也无法获取 ${symbol} 日线数据`);
            }
          }
          history = stockHistory.map(item => ({ date: item.date, value: item.close }));
        }
      } else {
        // 分钟数据分支（处理 15m、1h、6h 等）—— 原样保留，确保 1d 能正确进入
        const validResolutions = ['15m', '1h', '4h', '6h'];
        let resolution: string;
        if (validResolutions.includes(range)) {
          resolution = range;
        } else {
          const rangeToStockResolution: Record<string, string> = {
            '15m': '15m',
            '1d': '1h',
            '1M': '6h',
          };
          resolution = rangeToStockResolution[range];
          if (!resolution) {
            resolution = rangeToResolution[range];
          }
        }
        if (!resolution) {
          return NextResponse.json({ error: `不支持的 range 参数: ${rawRange}` }, { status: 400 });
        }
        const perfLabel = `[性能] 股票 ${symbol} ${resolution}`;
        console.time(perfLabel);
        const latestData = await getStockMinuteHistory(symbol, resolution, 1);
        console.log(`[历史API] 股票 latestData raw =`, latestData[0]);
        console.timeLog(perfLabel, '获取最新一条数据完成');
        let lastTimestamp: number | null = null;
        if (latestData.length > 0 && latestData[0] != null) {
          const ts = latestData[0].timestamp;
          if (typeof ts === 'number' && !isNaN(ts)) {
            lastTimestamp = ts;
          } else if (typeof ts === 'string') {
            const parsed = parseFloat(ts);
            if (!isNaN(parsed)) lastTimestamp = parsed;
          }
        }
        console.log(`[历史API] 股票处理后的 lastTimestamp = ${lastTimestamp}`);
        const totalData = await getStockMinuteHistory(symbol, resolution, limit);
        const dataCount = totalData.length;
        console.timeLog(perfLabel, `获取总数据量完成，共 ${dataCount} 条`);
        const needFetch = isDataStale(lastTimestamp, resolution) || dataCount < limit * 0.8;
        if (needFetch) {
          console.log(`[历史API] 股票 ${symbol} ${resolution} 需要更新 (陈旧=${isDataStale(lastTimestamp, resolution)}, 当前数据量=${dataCount}/${limit})，触发拉取`);
          let sinceTimestamp: number | undefined;
          if (lastTimestamp && dataCount >= limit * 0.8) {
            const periodSec = timeframeSeconds[resolution] || 900;
            let tsSeconds = lastTimestamp;
            if (lastTimestamp > 1e11) {
              tsSeconds = Math.floor(lastTimestamp / 1000);
              console.log(`[历史API] 股票检测到 lastTimestamp 可能是毫秒，转换为秒: ${lastTimestamp} -> ${tsSeconds}`);
            }
            sinceTimestamp = (tsSeconds + periodSec) * 1000;
            console.log(`[历史API] 股票增量 sinceTimestamp = ${sinceTimestamp} (${new Date(sinceTimestamp).toISOString()})`);
          } else {
            console.log(`[历史API] 股票无数据或数据不足，拉取全量 (最近 ${limit*2} 条)`);
            sinceTimestamp = undefined;
          }
          if (sinceTimestamp) {
            const now = Date.now();
            if (sinceTimestamp > now + 365 * 24 * 60 * 60 * 1000) {
              console.log(`[历史API] 股票 sinceTimestamp 过大，重置为当前时间`);
              sinceTimestamp = now;
            }
          }
          console.timeLog(perfLabel, '开始拉取外部分钟数据');
          let freshData: any[] | null = null;
          const isAStock = symbol.includes('.SS') || symbol.includes('.SZ');
          if (isAStock) {
            if (resolution === '4h' || resolution === '6h') {
              console.log(`[历史API] A股 ${resolution} 数据使用雅虎获取`);
              freshData = await fetchStockMinuteData(symbol, resolution, limit * 2, sinceTimestamp);
            } else {
              console.log(`[历史API] 使用新浪获取A股分钟数据`);
              freshData = await fetchAStockMinuteDataFromSina(symbol, resolution, limit * 2, sinceTimestamp);
            }
          } else {
            const isHKStock = symbol.includes('.HK') || /^\d{4,5}$/.test(symbol);
            if (isHKStock) {
              console.log(`[历史API] 使用雅虎获取港股分钟数据`);
              freshData = await fetchStockMinuteData(symbol, resolution, limit * 2, sinceTimestamp);
            } else {
              console.log(`[历史API] 使用 Tiingo 获取美股分钟数据`);
              freshData = await fetchTiingoMinuteData(symbol, resolution, limit * 2, sinceTimestamp);
              if (!freshData || freshData.length === 0) {
                console.warn(`[历史API] Tiingo 拉取失败，尝试雅虎作为后备`);
                freshData = await fetchStockMinuteData(symbol, resolution, limit * 2, sinceTimestamp);
              }
            }
          }
          console.timeLog(perfLabel, `外部数据拉取完成，获取 ${freshData?.length} 条`);
          if (freshData && freshData.length > 0) {
            const records = freshData.map(item => ({
              symbol,
              timestamp: item.timestamp,
              resolution,
              open: item.open,
              high: item.high,
              low: item.low,
              close: item.close,
              volume: item.volume,
            }));
            await saveStockMinute(records);
            console.log(`[历史API] 股票已保存 ${records.length} 条 ${resolution} 数据`);
            console.timeLog(perfLabel, `保存 ${records.length} 条到数据库完成`);
          }
        } 
        const minuteData = await getStockMinuteHistory(symbol, resolution, limit);
        console.log(`[历史API] 股票从数据库获取到 ${minuteData.length} 条 ${resolution} 原始数据`);
        console.timeLog(perfLabel, `从数据库获取 ${limit} 条数据完成`);
        const processedData = minuteData
          .map(item => {
            if (!item) return null;
            let timestamp: number;
            if (typeof item.timestamp === 'number') {
              timestamp = item.timestamp;
            } else if (typeof item.timestamp === 'string') {
              const parsed = parseFloat(item.timestamp);
              if (isNaN(parsed)) return null;
              timestamp = parsed;
            } else {
              return null;
            }
            return {
              symbol: item.symbol,
              timestamp,
              resolution: item.resolution,
              open: item.open,
              high: item.high,
              low: item.low,
              close: item.close,
              volume: item.volume,
            };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null);
        if (processedData.length !== minuteData.length) {
          console.log(`[历史API] 股票过滤掉 ${minuteData.length - processedData.length} 条无效时间戳数据`);
        }
        console.timeLog(perfLabel, `数据处理/过滤完成，有效 ${processedData.length} 条`);
        const sortedData = processedData.sort((a, b) => a.timestamp - b.timestamp);
        console.log(`[历史API] 股票有效数据 ${sortedData.length} 条，范围: ${sortedData.length > 0 ? new Date(sortedData[0].timestamp * 1000).toISOString() : '无'} 至 ${sortedData.length > 0 ? new Date(sortedData[sortedData.length-1].timestamp * 1000).toISOString() : '无'}`);
        if (sortedData.length < 2) {
          console.log(`[历史API] 股票有效数据不足2条`);
        }
        history = sortedData.map(item => ({
          date: new Date(item.timestamp * 1000).toISOString(),
          value: item.close,
        }));
        console.timeLog(perfLabel, `最终数据组装完成，返回 ${history.length} 条`);
        console.timeEnd(perfLabel);
      }
    } else if (type === 'crypto') {
      if (range === 'since_holding') {
        console.time(`[性能] 加密货币 ${symbol} 日线`);
        const startDate = request.nextUrl.searchParams.get('startDate');
        if (!startDate) {
          return NextResponse.json({ error: '缺少 startDate 参数' }, { status: 400 });
        }
        if (isOverFiveYears(startDate)) {
          console.log(`[历史API] 加密货币买入日期超过5年，使用月线数据`);
          const monthlyData = await getCryptoMonthlyHistory(symbol, startDate);
          history = monthlyData.map(item => ({ date: item.date, value: item.close }));
        } else {
          console.log(`[历史API] 加密货币买入日期5年以内，使用日线数据`);
          const needsDailyUpdate = await needsCryptoDailyUpdate(symbol);
          console.log(`[历史API] ${symbol} needsDailyUpdate = ${needsDailyUpdate}`);
          if (needsDailyUpdate) {
            console.log(`[历史API] ${symbol} 日线数据陈旧，触发增量更新`);
            const baseSymbol = symbol.split('/')[0];
            const lastDateStr = await getLatestCryptoDate(symbol);
            console.log(`[历史API] 数据库中最新的日期: ${lastDateStr}`);
            let sinceTimestamp: number | undefined;
            if (lastDateStr) {
              const [year, month, day] = lastDateStr.split('-').map(Number);
              const nextDayUTC = Date.UTC(year, month - 1, day + 1);
              sinceTimestamp = nextDayUTC;
              console.log(`[历史API] 计算的 sinceTimestamp = ${sinceTimestamp} (${new Date(sinceTimestamp).toISOString()})`);
            } else {
              console.log(`[历史API] 无历史数据，将拉取全量`);
            }
            console.timeLog(`[性能] 加密货币 ${symbol} 日线`, '开始拉取外部数据');
            const freshDaily = await fetchCryptoDailyHistory(baseSymbol, sinceTimestamp);
            console.timeLog(`[性能] 加密货币 ${symbol} 日线`, `拉取完成，获取 ${freshDaily?.length} 条`);
            if (freshDaily && freshDaily.length > 0) {
              const records = freshDaily.map(item => ({
                symbol,
                date: new Date(item.timestamp * 1000).toISOString().split('T')[0],
                open: item.open,
                high: item.high,
                low: item.low,
                close: item.close,
                volume: item.volume,
              }));
              await saveCryptoHistory(records);
              console.log(`[历史API] 已保存 ${records.length} 条日线数据`);
            }
          }
          const cryptoHistory = await getCryptoHistorySince(symbol, startDate);
          console.log(`[历史API] getCryptoHistorySince 返回 ${cryptoHistory.length} 条数据`);
          history = cryptoHistory.map(item => ({ date: item.date, value: item.close }));
        }
        console.timeEnd(`[性能] 加密货币 ${symbol} 日线`);
      } else {
        let resolution: string;
        if (['15m', '1h', '6h'].includes(range)) {
          resolution = range;
        } else {
          resolution = rangeToResolution[range];
          if (!resolution) {
            return NextResponse.json({ error: `不支持的 range 参数: ${rawRange}` }, { status: 400 });
          }
        }
        const perfLabel = `[性能] 加密货币 ${symbol} ${resolution}`;
        console.time(perfLabel);
        const latestData = await getCryptoMinuteHistory(symbol, resolution, 1);
        console.log(`[历史API] latestData raw =`, latestData[0]);
        console.timeLog(perfLabel, '获取最新一条数据完成');
        let lastTimestamp: number | null = null;
        if (latestData.length > 0 && latestData[0] != null) {
          const ts = latestData[0].timestamp;
          if (typeof ts === 'number' && !isNaN(ts)) {
            lastTimestamp = ts;
          } else if (typeof ts === 'string') {
            const parsed = parseFloat(ts);
            if (!isNaN(parsed)) lastTimestamp = parsed;
          }
        }
        console.log(`[历史API] 处理后的 lastTimestamp = ${lastTimestamp}`);
        const totalData = await getCryptoMinuteHistory(symbol, resolution, limit);
        const dataCount = totalData.length;
        console.timeLog(perfLabel, `获取总数据量完成，共 ${dataCount} 条`);
        const needFetch = isDataStale(lastTimestamp, resolution) || dataCount < limit * 0.8;
        if (needFetch) {
          console.log(`[历史API] ${symbol} ${resolution} 需要更新 (陈旧=${isDataStale(lastTimestamp, resolution)}, 当前数据量=${dataCount}/${limit})，触发拉取`);
          const baseSymbol = symbol.split('/')[0];
          let sinceTimestamp: number | undefined;
          if (lastTimestamp && dataCount >= limit * 0.8) {
            const periodSec = timeframeSeconds[resolution] || 900;
            let tsSeconds = lastTimestamp;
            if (lastTimestamp > 1e11) {
              tsSeconds = Math.floor(lastTimestamp / 1000);
              console.log(`[历史API] 检测到 lastTimestamp 可能是毫秒，转换为秒: ${lastTimestamp} -> ${tsSeconds}`);
            }
            sinceTimestamp = (tsSeconds + periodSec) * 1000;
            console.log(`[历史API] 增量 sinceTimestamp = ${sinceTimestamp} (${new Date(sinceTimestamp).toISOString()})`);
          } else {
            console.log(`[历史API] 数据不足或陈旧，拉取全量 (最近 ${limit*2} 条)`);
            sinceTimestamp = undefined;
          }
          if (sinceTimestamp) {
            const now = Date.now();
            if (sinceTimestamp > now + 365 * 24 * 60 * 60 * 1000) {
              console.log(`[历史API] sinceTimestamp 过大 (${sinceTimestamp})，重置为当前时间`);
              sinceTimestamp = now;
            }
          }
          console.timeLog(perfLabel, '开始拉取外部分钟数据');
          const freshData = await fetchCryptoMinuteData(baseSymbol, resolution, limit * 2, sinceTimestamp);
          console.timeLog(perfLabel, `外部数据拉取完成，获取 ${freshData?.length} 条`);
          if (freshData && freshData.length > 0) {
            const records = freshData.map(item => ({
              symbol,
              timestamp: item.timestamp,
              resolution,
              open: item.open,
              high: item.high,
              low: item.low,
              close: item.close,
              volume: item.volume,
            }));
            await saveCryptoMinute(records);
            console.log(`[历史API] 已保存 ${records.length} 条 ${resolution} 数据`);
            console.timeLog(perfLabel, `保存 ${records.length} 条到数据库完成`);
          }
        }
        const minuteData = await getCryptoMinuteHistory(symbol, resolution, limit);
        console.log(`[历史API] 从数据库获取到 ${minuteData.length} 条 ${resolution} 原始数据`);
        console.timeLog(perfLabel, `从数据库获取 ${limit} 条数据完成`);
        const processedData = minuteData
          .map(item => {
            if (!item) return null;
            let timestamp: number;
            if (typeof item.timestamp === 'number') {
              timestamp = item.timestamp;
            } else if (typeof item.timestamp === 'string') {
              const parsed = parseFloat(item.timestamp);
              if (isNaN(parsed)) return null;
              timestamp = parsed;
            } else {
              return null;
            }
            return {
              symbol: item.symbol,
              timestamp,
              resolution: item.resolution,
              open: item.open,
              high: item.high,
              low: item.low,
              close: item.close,
              volume: item.volume,
            };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null);
        if (processedData.length !== minuteData.length) {
          console.log(`[历史API] 过滤掉 ${minuteData.length - processedData.length} 条无效时间戳数据`);
        }
        console.timeLog(perfLabel, `数据处理/过滤完成，有效 ${processedData.length} 条`);
        const sortedData = processedData.sort((a, b) => a.timestamp - b.timestamp);
        console.log(`[历史API] 有效数据 ${sortedData.length} 条，范围: ${sortedData.length > 0 ? new Date(sortedData[0].timestamp * 1000).toISOString() : '无'} 至 ${sortedData.length > 0 ? new Date(sortedData[sortedData.length-1].timestamp * 1000).toISOString() : '无'}`);
        if (sortedData.length < 2) {
          console.log(`[历史API] 有效数据不足2条`);
        }
        history = sortedData.map(item => ({
          date: new Date(item.timestamp * 1000).toISOString(),
          value: item.close,
        }));
        console.timeLog(perfLabel, `最终数据组装完成，返回 ${history.length} 条`);
        console.timeEnd(perfLabel);
      }
    }

    console.log(`[历史API] 返回数据条数: ${history.length}，第一条日期: ${history[0]?.date}，最后一条日期: ${history[history.length-1]?.date}`);
    const response = NextResponse.json({ success: true, data: history });
    if (type === 'fund') {
      response.headers.set('Cache-Control', 'private, max-age=60');
    }
    return response;
  } catch (error: any) {
    console.error('[历史API] 错误:', error);
    return NextResponse.json({ success: false, data: [], error: error.message });
  }
}
*/