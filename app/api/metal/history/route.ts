import { NextRequest, NextResponse } from 'next/server';
import { getMetalHistory, getMetalHistorySince } from '@/src/services/fundHistoryDB';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const days = request.nextUrl.searchParams.get('days');
  const startDate = request.nextUrl.searchParams.get('startDate');

  if (!code) {
    return NextResponse.json({ error: '缺少贵金属代码' }, { status: 400 });
  }

  try {
    let history;
    if (startDate) {
      history = await getMetalHistorySince(code, startDate);
    } else if (days) {
      history = await getMetalHistory(code, parseInt(days));
    } else {
      return NextResponse.json({ error: '缺少 days 或 startDate 参数' }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      data: history.map(item => ({
        date: item.date,
        value: item.price,
      })),
    });
  } catch (error: any) {
    console.error('[贵金属历史API] 错误:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}