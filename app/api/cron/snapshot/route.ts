// app/api/cron/snapshot/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.POSTGRES_URL!);
const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const baseUrl = request.nextUrl.origin;

    // ✅ 改为从 users 表获取用户
    const users = await sql`SELECT phone FROM users`;
    const results = [];

    for (const user of users) {
      const response = await fetch(`${baseUrl}/api/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.phone }),
      });
      const data = await response.json();
      results.push({ userId: user.phone, success: response.ok, data });
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Cron snapshot error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}