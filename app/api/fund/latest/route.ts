import { NextRequest, NextResponse } from 'next/server';
import { getLatestFundNav } from '@/src/services/fundHistoryDB';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (!code) {
    return NextResponse.json({ error: '缺少基金代码' }, { status: 400 });
  }

  // 清理代码，移除 .OF 后缀
  const cleanCode = code.replace(/\.OF$/, '');
  
  try {
    const latestNav = await getLatestFundNav(cleanCode);
    if (!latestNav) {
      return NextResponse.json({ error: '未找到基金数据' }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      price: latestNav.nav,
      changePercent: latestNav.change,
      date: latestNav.date,
    });
  } catch (error: any) {
    console.error('[基金最新净值API] 错误:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}