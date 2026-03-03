// app/api/history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { 
  getFundHistory, 
  getCryptoHistory, 
  getCryptoMinuteHistory, 
  getStockHistory,
  saveCryptoMinute,
  getCryptoHistorySince,
} from '@/src/services/fundHistoryDB';
import { fetchCryptoMinuteData } from '../data-sources/crypto-ccxt';

// 判断数据是否陈旧（需要更新）
function isDataStale(lastTimestamp: number | null, resolution: string): boolean {
  if (!lastTimestamp) return true; // 无数据，需要拉取

  const nowSeconds = Math.floor(Date.now() / 1000);
  const ageSeconds = nowSeconds - lastTimestamp;

  // 根据分辨率设定最大允许年龄（秒）
  const maxAgeMap: Record<string, number> = {
    '15m': 15 * 60,      // 15分钟
    '30m': 30 * 60,      // 30分钟
    '1h': 60 * 60,       // 1小时
  };
  const maxAge = maxAgeMap[resolution] || 30 * 60; // 默认30分钟
  return ageSeconds > maxAge;
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol');
  const type = request.nextUrl.searchParams.get('type');
  const range = request.nextUrl.searchParams.get('range') || '1d';
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '365');

  if (!symbol || !type) {
    return NextResponse.json({ error: '缺少参数' }, { status: 400 });
  }

  try {
    let history: { date: string; value: number }[] = [];

    if (type === 'fund') {
      if (range === '1d') {
        const fundHistory = await getFundHistory(symbol, limit);
        history = fundHistory.map(item => ({ date: item.date, value: item.nav }));
      } else {
        history = [];
      }
    } else if (type === 'stock' || type === 'etf') {
      const stockHistory = await getStockHistory(symbol, limit);
      history = stockHistory.map(item => ({ date: item.date, value: item.close }));
    }  else if (type === 'crypto') {
      if (range === '1d') {
        const cryptoHistory = await getCryptoHistory(symbol, limit);
        history = cryptoHistory.map(item => ({ date: item.date, value: item.close }));
      } else if (range === 'since_holding') {
        const startDate = request.nextUrl.searchParams.get('startDate');
        if (!startDate) {
          return NextResponse.json({ error: '缺少 startDate 参数' }, { status: 400 });
        }
        const cryptoHistory = await getCryptoHistorySince(symbol, startDate);
        history = cryptoHistory.map(item => ({ date: item.date, value: item.close }));
      } else {
        // 分钟数据：检查是否需要更新
        const latestData = await getCryptoMinuteHistory(symbol, range, 1);
        const lastTimestamp = latestData.length > 0 ? latestData[0].timestamp : null;

        if (isDataStale(lastTimestamp, range)) {
          console.log(`[历史API] ${symbol} ${range} 数据陈旧，触发拉取`);
          const baseSymbol = symbol.split('/')[0];
          const freshData = await fetchCryptoMinuteData(baseSymbol, range, limit * 2);
          if (freshData && freshData.length > 0) {
            const records = freshData.map(item => ({
              symbol,
              timestamp: item.timestamp,
              resolution: range,
              open: item.open,
              high: item.high,
              low: item.low,
              close: item.close,
              volume: item.volume,
            }));
            await saveCryptoMinute(records);
            console.log(`[历史API] 已保存 ${records.length} 条 ${range} 数据`);
          }
        }

        const minuteData = await getCryptoMinuteHistory(symbol, range, limit);
        history = minuteData.map(item => ({
          date: new Date(item.timestamp * 1000).toISOString(),
          value: item.close,
        }));
      }
    }

    return NextResponse.json({ success: true, data: history });
  } catch (error: any) {
    console.error('[历史API] 错误:', error);
    return NextResponse.json({ success: false, data: [], error: error.message });
  }
}