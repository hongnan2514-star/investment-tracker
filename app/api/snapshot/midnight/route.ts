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

  let beijingDate: Date;
  if (dateParam) {
    const parts = dateParam.split('-').map(Number);
    if (parts.length !== 3) {
      return NextResponse.json({ error: 'Invalid date format, use YYYY-MM-DD' }, { status: 400 });
    }
    // 构造北京时间 0 点
    beijingDate = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0);
  } else {
    const now = new Date();
    beijingDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  }

  // 北京时间 0 点对应的 UTC 时间是前一天的 16:00:00
  const utcSnapshotTime = new Date(beijingDate.getTime() - 8 * 60 * 60 * 1000);
  
  // 查询精确匹配该 UTC 时间的快照
  const result = await sql`
    SELECT net_worth FROM snapshots
    WHERE user_id = ${userId} AND snapshot_time = ${utcSnapshotTime.toISOString()}
  `;

  const netWorth = result.length > 0 ? result[0].net_worth : null;
  return NextResponse.json({ netWorth, date: dateParam || new Date().toISOString().split('T')[0] });
}