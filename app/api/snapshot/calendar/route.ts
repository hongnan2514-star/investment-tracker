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

    const snapshots = await sql`
      SELECT snapshot_time, net_worth
      FROM snapshots
      WHERE user_id = ${userId}
      ORDER BY snapshot_time ASC
    `;

    // 存储每个北京时间日期的 0 点净值
    const netWorthByDate = new Map<string, number>();

    for (const s of snapshots) {
      const utcTime = new Date(s.snapshot_time);

      // 计算北京时间小时（UTC+8）
      const beijingHour = (utcTime.getUTCHours() + 8) % 24;
      if (beijingHour !== 0) continue; // 只处理北京时间 0 点的快照

      // 确定北京时间日期（YYYY-MM-DD）
      let year = utcTime.getUTCFullYear();
      let month = utcTime.getUTCMonth();
      let day = utcTime.getUTCDate();

      // 若 UTC 时间 >= 16:00，北京时间已是第二天
      if (utcTime.getUTCHours() >= 16) {
        const nextDay = new Date(Date.UTC(year, month, day + 1));
        year = nextDay.getUTCFullYear();
        month = nextDay.getUTCMonth();
        day = nextDay.getUTCDate();
      }

      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      netWorthByDate.set(dateStr, Number(s.net_worth));
    }

    // 按日期排序
    const sortedDates = Array.from(netWorthByDate.keys()).sort();

    const returns: { date: string; value: number }[] = [];
    for (let i = 1; i < sortedDates.length; i++) {
      const today = sortedDates[i];
      const yesterday = sortedDates[i - 1];
      const todayValue = netWorthByDate.get(today)!;
      const yesterdayValue = netWorthByDate.get(yesterday)!;
      const profit = todayValue - yesterdayValue;
      returns.push({ date: today, value: profit });
    }

    return NextResponse.json({ success: true, data: returns });
  } catch (error) {
    console.error('[Calendar] 获取收益日历失败:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}