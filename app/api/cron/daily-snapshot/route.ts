// app/api/cron/daily-snapshot/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/src/lib/db';

// 同时支持 GET 和 POST 请求
export async function GET(req: NextRequest) {
  return handleRequest(req);
}

export async function POST(req: NextRequest) {
  return handleRequest(req);
}

async function handleRequest(req: NextRequest) {
  // 从请求头获取 Authorization
  const authHeader = req.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    console.error('CRON_SECRET 未配置');
    return NextResponse.json({ error: '服务器配置错误' }, { status: 500 });
  }

  // 验证 Bearer Token
  if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
    console.warn('未授权的定时任务调用');
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    // 更新所有资产的昨日收盘市值
    const result = await query(`
      UPDATE assets
      SET yesterday_close_value = market_value,
          last_updated = NOW()
      WHERE market_value IS NOT NULL
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