// app/api/cron/snapshot/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.POSTGRES_URL!);
const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(request: NextRequest) {
  // 验证密钥
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 获取当前请求的 origin，即您的应用固定域名
    const baseUrl = request.nextUrl.origin;

    // 获取所有有资产的用户ID
    const users = await sql`SELECT DISTINCT user_id FROM assets`;
    const results = [];

    for (const user of users) {
      // 调用内部快照 API，使用 baseUrl 构建完整 URL
      const response = await fetch(`${baseUrl}/api/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.user_id }),
      });
      const data = await response.json();
      results.push({ userId: user.user_id, success: response.ok, data });
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Cron snapshot error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}