// app/api/history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { 
  getFundHistory, 
  getCryptoHistory, 
  getCryptoMinuteHistory, 
  getStockHistory
} from '@/src/services/fundHistoryDB';

// 以下两个函数如果其他地方不再使用，可以安全删除；为兼容性可暂时保留
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
  return targetLimit * factor + factor;
}

function aggregateMinutesToTarget(
  minuteData: { timestamp: number; close: number }[],
  targetResolution: string
): { timestamp: number; close: number }[] {
  if (minuteData.length === 0) return [];
  const sorted = minuteData.sort((a, b) => a.timestamp - b.timestamp);
  const minutes = parseInt(targetResolution.replace('m', '').replace('h', ''));
  const targetMinutes = targetResolution.endsWith('h') ? minutes * 60 : minutes;
  const baseMinutes = 5;
  const groupSize = targetMinutes / baseMinutes;
  const result: { timestamp: number; close: number }[] = [];
  for (let i = 0; i < sorted.length; i += groupSize) {
    const group = sorted.slice(i, i + groupSize);
    if (group.length === 0) continue;
    const last = group[group.length - 1];
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
      const stockHistory = await getStockHistory(symbol, limit);
      history = stockHistory.map(item => ({ date: item.date, value: item.close }));
    } else if (type === 'crypto') {
      if (range === '1d') {
        const cryptoHistory = await getCryptoHistory(symbol, limit);
        history = cryptoHistory.map(item => ({ date: item.date, value: item.close }));
      } else {
        // 直接查询分钟表，range 作为分辨率参数
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