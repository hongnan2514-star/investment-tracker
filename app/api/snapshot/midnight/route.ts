import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.POSTGRES_URL!);

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startStr = today.toISOString();
  const endStr = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString();

  const result = await sql`
    SELECT net_worth FROM snapshots
    WHERE user_id = ${userId} AND snapshot_time >= ${startStr} AND snapshot_time < ${endStr}
    ORDER BY snapshot_time ASC LIMIT 1
  `;
  const netWorth = result.length > 0 ? result[0].net_worth : null;
  return NextResponse.json({ netWorth });
}