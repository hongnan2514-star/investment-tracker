import { NextRequest, NextResponse } from 'next/server';
import { fetchCryptoMinuteData } from '@/app/api/data-sources/crypto-ccxt';

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol');
  const start = request.nextUrl.searchParams.get('start');
  const end = request.nextUrl.searchParams.get('end');

  if (!symbol || !start || !end) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  try {
    const startDate = new Date(start);
    const endDate = new Date(end);
    // 获取过去 7 天的所有小时数据（最多 168 条）
    const minuteData = await fetchCryptoMinuteData(symbol, '1h', 168, startDate.getTime());
    if (!minuteData) {
      return NextResponse.json({ success: false, data: [] });
    }

    // 过滤在 [start, end] 之间的数据
    const filtered = minuteData.filter(
      point => point.timestamp >= startDate.getTime() / 1000 &&
               point.timestamp <= endDate.getTime() / 1000
    );
    const result = filtered.map(point => ({
      timestamp: point.timestamp * 1000, // 转换为毫秒
      close: point.close,
    }));
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[Hourly API] 获取小时数据失败:', error);
    return NextResponse.json({ success: false, data: [] }, { status: 500 });
  }
}