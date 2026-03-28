// app/api/midnight/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.POSTGRES_URL!);

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  // 获取当前北京时间（UTC+8）
  const now = new Date();
  const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const beijingMidnight = new Date(beijingTime.getFullYear(), beijingTime.getMonth(), beijingTime.getDate(), 0, 0, 0);
  // 将北京时间0点转换为 UTC 时间戳
  const startUTC = new Date(beijingMidnight.getTime() - 8 * 60 * 60 * 1000);
  const endUTC = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000);

  const startStr = startUTC.toISOString();
  const endStr = endUTC.toISOString();

  const result = await sql`
    SELECT net_worth FROM snapshots
    WHERE user_id = ${userId} AND snapshot_time >= ${startStr} AND snapshot_time < ${endStr}
    ORDER BY snapshot_time ASC LIMIT 1
  `;
  const netWorth = result.length > 0 ? result[0].net_worth : null;
  return NextResponse.json({ netWorth });
}