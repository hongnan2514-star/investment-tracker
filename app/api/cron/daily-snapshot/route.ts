// app/api/cron/daily-snapshot/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/src/lib/db';

export async function GET(req: NextRequest) {
  return handleRequest(req);
}

export async function POST(req: NextRequest) {
  return handleRequest(req);
}

async function handleRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    return NextResponse.json({ error: '服务配置错误' }, { status: 500 });
  }

  if (authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    // 将当前 price 记录为 yesterday_price
    const result = await query(`
      UPDATE assets
      SET yesterday_price = price::DECIMAL,
          last_updated = NOW()
      WHERE price IS NOT NULL
    `);

    return NextResponse.json({
      success: true,
      message: `快照更新成功，影响行数：${result.rowCount}`,
    });
  } catch (error) {
    console.error('更新失败:', error);
    return NextResponse.json({ error: '数据库更新失败' }, { status: 500 });
  }
}