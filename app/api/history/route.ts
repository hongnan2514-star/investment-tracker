// app/api/history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { 
  getFundHistory, 
  getCryptoHistory, 
  getCryptoMinuteHistory, 
  getStockHistory
  // 移除股票分钟相关导入
} from '@/src/services/fundHistoryDB';

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
  return targetLimit * factor + factor;
}

// 按目标分辨率聚合5分钟数据
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
      // 无论 range 是什么，统一返回日线数据
      const stockHistory = await getStockHistory(symbol, limit);
      history = stockHistory.map(item => ({ date: item.date, value: item.close }));
    } else if (type === 'crypto') {
      if (range === '1d') {
        const cryptoHistory = await getCryptoHistory(symbol, limit);
        history = cryptoHistory.map(item => ({ date: item.date, value: item.close }));
      } else {
        const baseLimit = getRequiredBaseLimit(range, limit);
        const minuteData = await getCryptoMinuteHistory(symbol, '5m', baseLimit);
        if (minuteData && minuteData.length > 0) {
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