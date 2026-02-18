import { NextResponse } from 'next/server';
import { getAllFundCodes } from '@/src/services/fundHistoryDB';
import { updateFundData } from '@/src/services/fundService';

// 可选：设置该路由的最长执行时间（Vercel Pro 可调整）
export const maxDuration = 60; // 单位秒，根据需要调整

export async function GET(request: Request) {
  // 验证请求头中的 Authorization: Bearer <CRON_SECRET>
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Cron] 开始自动更新基金数据...');
  
  const codes = getAllFundCodes();
  console.log(`[Cron] 共找到 ${codes.length} 只基金需要检查`);

  const results = [];
  const batchSize = 5; // 每批同时更新 5 只，避免请求过快

  for (let i = 0; i < codes.length; i += batchSize) {
    const batch = codes.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map(code => updateFundData(code))
    );
    results.push(...batchResults);
    
    // 每批间隔 2 秒，减轻目标服务器压力
    if (i + batchSize < codes.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  const successCount = results.filter(r => r.status === 'fulfilled').length;
  const failCount = results.filter(r => r.status === 'rejected').length;

  return NextResponse.json({
    message: '更新完成',
    total: codes.length,
    success: successCount,
    failed: failCount
  });
}