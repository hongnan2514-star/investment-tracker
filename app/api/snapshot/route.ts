// app/api/snapshot/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { convertAmount } from '@/src/services/forex';
import { CurrencyCode } from '@/src/services/currency';

const sql = neon(process.env.POSTGRES_URL!);

export async function POST(request: NextRequest) {
  try {
    const { userId, assets } = await request.json(); // 忽略 targetCurrency
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    let totalAssets = 0;
    let totalLiabilities = 0;

    if (assets && Array.isArray(assets)) {
      for (const asset of assets) {
        const fromCurrency = (asset.currency || 'USD') as CurrencyCode;
        let value = asset.marketValue;
        // 统一转换为 CNY
        if (fromCurrency !== 'CNY') {
          value = await convertAmount(value, fromCurrency, 'CNY');
        }
        if (asset.type === 'liability') {
          totalLiabilities += Math.abs(value);
        } else {
          totalAssets += value;
        }
      }
    } else {
      // 从数据库 assets 表查询
      const assetRows = await sql`
        SELECT market_value, currency, type FROM assets WHERE user_id = ${userId}
      `;
      for (const row of assetRows) {
        const fromCurrency = (row.currency || 'USD') as CurrencyCode;
        let value = row.market_value;
        if (fromCurrency !== 'CNY') {
          value = await convertAmount(value, fromCurrency, 'CNY');
        }
        if (row.type === 'liability') {
          totalLiabilities += Math.abs(value);
        } else {
          totalAssets += value;
        }
      }
    }

    const netWorth = totalAssets - totalLiabilities;

    // 使用北京时间（UTC+8）计算整点
    const now = new Date();
    const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const snapshotHour = new Date(beijingTime.getFullYear(), beijingTime.getMonth(), beijingTime.getDate(), beijingTime.getHours(), 0, 0);
    // 转换为 UTC 时间存储
    const snapshotTimeUTC = new Date(snapshotHour.getTime() - 8 * 60 * 60 * 1000).toISOString();

    const existing = await sql`
      SELECT id FROM snapshots WHERE user_id = ${userId} AND snapshot_time = ${snapshotTimeUTC}
    `;
    if (existing.length === 0) {
      await sql`
        INSERT INTO snapshots (user_id, snapshot_time, total_assets, total_liabilities, net_worth)
        VALUES (${userId}, ${snapshotTimeUTC}, ${totalAssets}, ${totalLiabilities}, ${netWorth})
      `;
    }

    return NextResponse.json({ success: true, totalAssets, totalLiabilities, netWorth });
  } catch (error) {
    console.error('快照API错误:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}