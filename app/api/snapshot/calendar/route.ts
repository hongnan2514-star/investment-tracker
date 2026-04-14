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

    const netWorthByDate = new Map<string, number>();

    for (const s of snapshots) {
      // 显式添加 'Z' 强制 JavaScript 按 UTC 解析数据库时间
      const utcTime = new Date(s.snapshot_time + 'Z');
      
      // 计算北京时间小时 (UTC+8)
      const beijingHour = (utcTime.getUTCHours() + 8) % 24;
      if (beijingHour !== 0) continue; // 只保留北京时间 0 点的快照

      // 计算北京时间对应的日期字符串
      const beijingDate = new Date(utcTime.getTime() + 8 * 60 * 60 * 1000);
      const year = beijingDate.getUTCFullYear();
      const month = String(beijingDate.getUTCMonth() + 1).padStart(2, '0');
      const day = String(beijingDate.getUTCDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      netWorthByDate.set(dateStr, Number(s.net_worth));
    }

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