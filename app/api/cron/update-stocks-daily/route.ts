import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { updateStockHistory } from '@/app/api/history/update/route';

// 创建 SQL 执行实例
const sql = neon(process.env.POSTGRES_URL!);

// 从 user_assets 表中获取所有唯一的股票/ETF代码
async function getAllStockSymbols(): Promise<string[]> {
  try {
    const result = await sql`
      SELECT DISTINCT asset->>'symbol' as symbol
      FROM user_assets,
      LATERAL jsonb_array_elements(assets) AS asset
      WHERE asset->>'type' IN ('stock', 'etf')
    `;
    return result.map(row => row.symbol).filter(Boolean);
  } catch (error) {
    console.error('查询股票代码失败:', error);
    return [];
  }
}

export const maxDuration = 300; // 5分钟超时

export async function GET(request: NextRequest) {
  // 验证 CRON_SECRET，防止外部调用
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const symbols = await getAllStockSymbols();
    console.log(`[股票日线更新] 共找到 ${symbols.length} 只股票`);

    const results = [];
    const batchSize = 5;

    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(async (symbol) => {
          const result = await updateStockHistory(symbol);
          return { symbol, ...result };
        })
      );
      results.push(...batchResults);
      if (i + batchSize < symbols.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error('股票日线更新失败:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}