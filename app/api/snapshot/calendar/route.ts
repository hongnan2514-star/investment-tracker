// app/api/snapshot/calendar/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.POSTGRES_URL!);

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    // 获取该用户所有 0 点快照（按时间正序）
    const snapshots = await sql`
      SELECT snapshot_time, net_worth
      FROM snapshots
      WHERE user_id = ${userId}
      ORDER BY snapshot_time ASC
    `;

    // 转换为每日净值：北京时间日期 -> 净值
    const dailyNetWorth: { date: string; netWorth: number }[] = [];
    for (const s of snapshots) {
      const utcTime = new Date(s.snapshot_time);
      const beijingTime = new Date(utcTime.getTime() + 8 * 60 * 60 * 1000);
      // 只取北京时间0点的快照
      if (beijingTime.getUTCHours() === 0) {
        const dateStr = beijingTime.toISOString().split('T')[0];
        dailyNetWorth.push({ date: dateStr, netWorth: Number(s.net_worth) });
      }
    }

    // 计算每日收益（相邻两日0点净值差）
    const returns: { date: string; value: number }[] = [];
    for (let i = 1; i < dailyNetWorth.length; i++) {
      const today = dailyNetWorth[i];
      const yesterday = dailyNetWorth[i - 1];
      const profit = today.netWorth - yesterday.netWorth;
      returns.push({ date: today.date, value: profit });
    }

    return NextResponse.json({ success: true, data: returns });
  } catch (error) {
    console.error('[Calendar] 获取收益日历失败:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}