// app/api/history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getFundHistory } from '@/src/services/fundHistoryDB';
import { queryFinnhub } from '@/app/api/data-sources/finnhub';
import { getCryptoHistory, getCryptoMinuteHistory } from '@/src/services/fundHistoryDB';

// 将分钟数转换为对应的基础数据点数量（以5分钟为基础）
function getRequiredBaseLimit(targetResolution: string, targetLimit: number): number {
  const minutesMap: Record<string, number> = {
    '5m': 1,
    '15m': 3,
    '30m': 6,
    '1h': 12,
    '2h': 24,
    '4h': 48,
    '6h': 72,
    '12h': 144,
    '1d': 288,
  };
  const factor = minutesMap[targetResolution] || 1;
  // 额外多取一些，防止边界缺失
  return targetLimit * factor + factor;
}

// 按目标分辨率聚合5分钟数据
function aggregateMinutesToTarget(
  minuteData: { timestamp: number; close: number }[],
  targetResolution: string
): { timestamp: number; close: number }[] {
  if (minuteData.length === 0) return [];

  // 先按时间升序排序
  const sorted = minuteData.sort((a, b) => a.timestamp - b.timestamp);

  const minutes = parseInt(targetResolution.replace('m', '').replace('h', ''));
  const targetMinutes = targetResolution.endsWith('h') ? minutes * 60 : minutes;
  const baseMinutes = 5; // 基础粒度为5分钟
  const groupSize = targetMinutes / baseMinutes;

  const result: { timestamp: number; close: number }[] = [];
  for (let i = 0; i < sorted.length; i += groupSize) {
    const group = sorted.slice(i, i + groupSize);
    if (group.length === 0) continue;
    // 取该组最后一个元素的收盘价作为该时段的收盘价
    const last = group[group.length - 1];
    // 时间戳取该时段的开始时间（组内第一个时间戳）
    const groupStart = group[0].timestamp;
    result.push({ timestamp: groupStart, close: last.close });
  }
  return result;
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
      const to = Math.floor(Date.now() / 1000);
      const from = to - 365 * 24 * 60 * 60;
      const res = await fetch(
        `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${to}&token=${process.env.FINNHUB_API_KEY}`
      );
      const data = await res.json();
      if (data.s === 'ok') {
        history = data.t.map((timestamp: number, index: number) => ({
          date: new Date(timestamp * 1000).toISOString().split('T')[0],
          value: data.c[index],
        }));
      }
    } else if (type === 'crypto') {
      if (range === '1d') {
        // 日线直接从日线表读取
        const cryptoHistory = await getCryptoHistory(symbol, limit);
        history = cryptoHistory.map(item => ({ date: item.date, value: item.close }));
      } else {
        // 分钟级数据：从5分钟表获取足够的基础数据
        const baseLimit = getRequiredBaseLimit(range, limit);
        const minuteData = await getCryptoMinuteHistory(symbol, '5m', baseLimit);
        if (minuteData && minuteData.length > 0) {
          // 聚合为目标分辨率
          const aggregated = aggregateMinutesToTarget(minuteData, range);
          history = aggregated.map(item => ({
            date: new Date(item.timestamp * 1000).toISOString(),
            value: item.close,
          }));
        } else {
          history = [];
        }
      }
    }

    return NextResponse.json({ success: true, data: history });
  } catch (error: any) {
    console.error('[历史API] 错误:', error);
    return NextResponse.json({ success: false, data: [], error: error.message });
  }
}