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

    // 1. 获取用户所有快照（按时间排序）
    const snapshots = await sql`
      SELECT snapshot_time, net_worth
      FROM snapshots
      WHERE user_id = ${userId}
      ORDER BY snapshot_time ASC
    `;

    // 2. 构建日期到净值的映射，使用与 /api/midnight 完全相同的匹配逻辑：
    //    北京时间 0 点对应的 UTC 时间戳为：当日 UTC 0 点 + 16 小时 = 当日 16:00 UTC
    //    数据库中的 snapshot_time 存储的是 UTC 时间，直接精确匹配。
    const netWorthByDate = new Map<string, number>();

    for (const s of snapshots) {
      const utcTime = new Date(s.snapshot_time + 'Z'); // 确保 UTC 解析

      // 只保留 UTC 时间为 16:00 的快照（对应北京时间次日 0 点）
      if (utcTime.getUTCHours() !== 16) continue;
      if (utcTime.getUTCMinutes() !== 0) continue;
      if (utcTime.getUTCSeconds() !== 0) continue;

      // 计算对应的北京时间日期
      const beijingDate = new Date(utcTime.getTime() + 8 * 60 * 60 * 1000);
      const year = beijingDate.getUTCFullYear();
      const month = String(beijingDate.getUTCMonth() + 1).padStart(2, '0');
      const day = String(beijingDate.getUTCDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      netWorthByDate.set(dateStr, Number(s.net_worth));
    }

    // 3. 按日期排序
    const sortedDates = Array.from(netWorthByDate.keys()).sort();

    // 4. 计算每日收益（相邻两日净值差）
    const returns: { date: string; value: number }[] = [];
    for (let i = 1; i < sortedDates.length; i++) {
      const today = sortedDates[i];
      const yesterday = sortedDates[i - 1];
      const todayValue = netWorthByDate.get(today)!;
      const yesterdayValue = netWorthByDate.get(yesterday)!;
      returns.push({ date: today, value: todayValue - yesterdayValue });
    }

    return NextResponse.json({ success: true, data: returns });
  } catch (error) {
    console.error('[Calendar] 获取收益日历失败:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}