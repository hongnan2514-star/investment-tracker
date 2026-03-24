// app/api/cron/snapshot/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.POSTGRES_URL!);
// 从环境变量中获取密钥，需在 Vercel 中配置
const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(request: NextRequest) {
  // 验证密钥
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 获取所有有资产的用户ID（从 assets 表去重）
    const users = await sql`SELECT DISTINCT user_id FROM assets`;
    const results = [];

    for (const user of users) {
      // 调用内部快照 API，不传 assets，让其从数据库读取
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/snapshot`, {
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