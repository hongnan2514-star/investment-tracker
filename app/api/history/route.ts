// app/api/history/route.ts
import { NextRequest, NextResponse } from 'next/server';
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
} from '@/src/services/fundHistoryDB';
import { fetchCryptoMinuteData, fetchCryptoDailyHistory, } from '../data-sources/crypto-ccxt';
import { fetchStockMinuteData } from '../data-sources/yahoo-finance';

const timeframeSeconds: Record<string, number> = {
  '15m': 15 * 60,
  '30m': 30 * 60,
  '1h': 60 * 60,
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

export async function GET(request: NextRequest) {
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
      console.time(`[性能] 基金 ${symbol} ${range}`);
      if (range === '1d') {
        const fundHistory = await getFundHistory(symbol, limit);
        history = fundHistory.map(item => ({ date: item.date, value: item.nav }));
      } else {
        history = [];
      }
      console.timeEnd(`[性能] 基金 ${symbol} ${range}`);
    } else if (type === 'stock' || type === 'etf') {
      // 处理日线数据（包括 since_holding 和 1d）
      if (range === 'since_holding' || range === '1d') {
        // 如果是 since_holding，需要 startDate 参数
        if (range === 'since_holding') {
          const startDate = request.nextUrl.searchParams.get('startDate');
          if (!startDate) {
            return NextResponse.json({ error: '缺少 startDate 参数' }, { status: 400 });
          }
          console.log(`[历史API] 股票 since_holding: symbol=${symbol}, startDate=${startDate}`);
          // 使用足够大的天数（10000天≈27年）确保包含 startDate
          const stockHistory = await getStockHistory(symbol, 100000);
          console.log(`[历史API] getStockHistory 返回 ${stockHistory.length} 条数据`);
          if (stockHistory.length > 0) {
            console.log(`[历史API] 第一条数据日期原始值:`, stockHistory[0].date);
          }
          // 将 startDate 转为时间戳进行过滤
          const startTimestamp = new Date(startDate).getTime();
          const filtered = stockHistory.filter(item => {
            const itemTimestamp = new Date(item.date).getTime();
            return itemTimestamp >= startTimestamp;
          });
          console.log(`[历史API] 过滤后得到 ${filtered.length} 条数据`);
          history = filtered.map(item => ({ date: item.date, value: item.close }));
        } else {
          // 1d（月线）：直接获取最近 limit 条日线数据（getStockHistory 已按日期升序返回）
          const stockHistory = await getStockHistory(symbol, limit);
          history = stockHistory.map(item => ({ date: item.date, value: item.close }));
        }
      } else {
        // 分钟数据分支（处理 15m、1h 等）
        // 定义有效分辨率列表（前端可能直接传这些值）
        const validResolutions = ['15m', '1h', '6h'];
        let resolution: string;

        if (validResolutions.includes(range)) {
          // 如果已经是有效分辨率，直接使用
          resolution = range;
        } else {
          // 尝试通过映射表转换
          const rangeToStockResolution: Record<string, string> = {
            '15m': '15m',
            '1d': '1h',
            '1M': '6h',
          };
          resolution = rangeToStockResolution[range];
          if (!resolution) {
            // 最后尝试通用映射表
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

        // 获取当前数据总量
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
          const freshData = await fetchStockMinuteData(symbol, resolution, limit * 2, sinceTimestamp);
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

        // 处理时间戳（股票分钟数据中 timestamp 应为秒级，直接使用）
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
        history = cryptoHistory.map(item => ({ date: item.date, value: item.close }));
        console.timeEnd(`[性能] 加密货币 ${symbol} 日线`);
      } else {
        // 分钟数据分支
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

        // 获取当前数据库中该分辨率的总数据条数（用于判断是否需要全量）
        const totalData = await getCryptoMinuteHistory(symbol, resolution, limit);
        const dataCount = totalData.length;
        console.timeLog(perfLabel, `获取总数据量完成，共 ${dataCount} 条`);

        // 判断是否需要拉取：数据陈旧 OR 数据量不足（少于限制的80%）
        const needFetch = isDataStale(lastTimestamp, resolution) || dataCount < limit * 0.8;

        if (needFetch) {
          console.log(`[历史API] ${symbol} ${resolution} 需要更新 (陈旧=${isDataStale(lastTimestamp, resolution)}, 当前数据量=${dataCount}/${limit})，触发拉取`);
          const baseSymbol = symbol.split('/')[0];
          let sinceTimestamp: number | undefined;

          if (lastTimestamp && dataCount >= limit * 0.8) {
            // 正常增量
            const periodSec = timeframeSeconds[resolution] || 900;
            let tsSeconds = lastTimestamp;
            if (lastTimestamp > 1e11) {
              tsSeconds = Math.floor(lastTimestamp / 1000);
              console.log(`[历史API] 检测到 lastTimestamp 可能是毫秒，转换为秒: ${lastTimestamp} -> ${tsSeconds}`);
            }
            sinceTimestamp = (tsSeconds + periodSec) * 1000;
            console.log(`[历史API] 增量 sinceTimestamp = ${sinceTimestamp} (${new Date(sinceTimestamp).toISOString()})`);
          } else {
            // 数据不足或没有最新时间戳，拉取全量
            console.log(`[历史API] 数据不足或陈旧，拉取全量 (最近 ${limit*2} 条)`);
            sinceTimestamp = undefined;
          }

          // 防止 sinceTimestamp 过大
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

        // 统一处理时间戳
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
    return NextResponse.json({ success: true, data: history });
  } catch (error: any) {
    console.error('[历史API] 错误:', error);
    return NextResponse.json({ success: false, data: [], error: error.message });
  }
}