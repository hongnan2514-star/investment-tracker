// app/api/snapshot/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { convertAmount } from '@/src/services/forex';

const sql = neon(process.env.POSTGRES_URL!);

export async function POST(request: NextRequest) {
  try {
    const { userId, assets, targetCurrency = 'CNY' } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    let totalAssets = 0;
    let totalLiabilities = 0;

    if (assets && Array.isArray(assets)) {
      for (const asset of assets) {
        const fromCurrency = asset.currency || 'USD';
        let value = asset.marketValue;
        if (fromCurrency !== targetCurrency) {
          value = await convertAmount(value, fromCurrency, targetCurrency);
        }
        if (asset.type === 'liability') {
          totalLiabilities += Math.abs(value);
        } else {
          totalAssets += value;
        }
      }
    } else {
      // 如果没有传入 assets，则从数据库 assets 表查询（备用）
      const assetRows = await sql`
        SELECT market_value, currency, type FROM assets WHERE user_id = ${userId}
      `;
      for (const row of assetRows) {
        const fromCurrency = row.currency || 'USD';
        let value = row.market_value;
        if (fromCurrency !== targetCurrency) {
          value = await convertAmount(value, fromCurrency, targetCurrency);
        }
        if (row.type === 'liability') {
          totalLiabilities += Math.abs(value);
        } else {
          totalAssets += value;
        }
      }
    }

    const netWorth = totalAssets - totalLiabilities;

    const now = new Date();
    const snapshotHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0);
    const snapshotTime = snapshotHour.toISOString();

    console.log(`[快照API] 准备插入: userId=${userId}, time=${snapshotTime}, assets=${totalAssets}, liabilities=${totalLiabilities}, netWorth=${netWorth}`);

    // 检查该小时是否已有快照（使用 snapshot_time 精确匹配）
    const existing = await sql`
      SELECT id FROM snapshots WHERE user_id = ${userId} AND snapshot_time = ${snapshotTime}
    `;
    if (existing.length === 0) {
      console.log(`[快照API] 插入新记录`);
      await sql`
        INSERT INTO snapshots (user_id, snapshot_time, total_assets, total_liabilities, net_worth)
        VALUES (${userId}, ${snapshotTime}, ${totalAssets}, ${totalLiabilities}, ${netWorth})
      `;
    } else {
      console.log(`[快照API] 该小时已有快照，跳过插入`);
    }

    return NextResponse.json({ success: true, totalAssets, totalLiabilities, netWorth });
  } catch (error) {
    console.error('快照API错误:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}