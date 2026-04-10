// app/api/midnight/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.POSTGRES_URL!);

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  const dateParam = request.nextUrl.searchParams.get('date'); // YYYY-MM-DD (北京时间)

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  let targetDate: Date;
  if (dateParam) {
    // 解析传入的日期（北京时间）
    const parts = dateParam.split('-').map(Number);
    if (parts.length !== 3) {
      return NextResponse.json({ error: 'Invalid date format, use YYYY-MM-DD' }, { status: 400 });
    }
    targetDate = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0);
  } else {
    // 默认今日（北京时间）
    const now = new Date();
    targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  }

  // 北京时间 0 点转为 UTC 时间范围（精确查找该时刻的快照）
  const startUTC = new Date(targetDate.getTime() - 8 * 60 * 60 * 1000);
  // 查询该时刻的快照（精确到小时）
  const result = await sql`
    SELECT net_worth FROM snapshots
    WHERE user_id = ${userId} AND snapshot_time = ${startUTC.toISOString()}
  `;

  const netWorth = result.length > 0 ? result[0].net_worth : null;
  return NextResponse.json({ netWorth, date: dateParam || new Date().toISOString().split('T')[0] });
}