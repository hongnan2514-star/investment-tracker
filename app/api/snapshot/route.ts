// app/api/snapshot/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { convertAmount } from '@/src/services/forex';
import { CurrencyCode } from '@/src/services/currency';

const sql = neon(process.env.POSTGRES_URL!);

export async function POST(request: NextRequest) {
  try {
    const { userId, assets: providedAssets } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    let assetList: any[] = [];

    // 优先使用传入的资产列表（前端调用时可能传）
    if (providedAssets && Array.isArray(providedAssets)) {
      assetList = providedAssets;
    } else {
      // 否则从 assets 明细表读取最新数据
      const result = await sql`
        SELECT symbol, name, price, holdings, market_value, currency, type, cost_price, purchase_date, notes, include_in_chart
        FROM assets WHERE user_id = ${userId}
      `;
      assetList = result;
    }

    if (assetList.length === 0) {
      // 无资产，净值为0
      const netWorth = 0;
      const now = new Date();
      const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
      const snapshotHour = new Date(beijingTime.getFullYear(), beijingTime.getMonth(), beijingTime.getDate(), beijingTime.getHours(), 0, 0);
      const snapshotTimeUTC = new Date(snapshotHour.getTime() - 8 * 60 * 60 * 1000).toISOString();

      const existing = await sql`
        SELECT id FROM snapshots WHERE user_id = ${userId} AND snapshot_time = ${snapshotTimeUTC}
      `;
      if (existing.length === 0) {
        await sql`
          INSERT INTO snapshots (user_id, snapshot_time, total_assets, total_liabilities, net_worth)
          VALUES (${userId}, ${snapshotTimeUTC}, 0, 0, 0)
        `;
      }
      return NextResponse.json({ success: true, totalAssets: 0, totalLiabilities: 0, netWorth: 0 });
    }

    let totalAssets = 0;
    let totalLiabilities = 0;

    for (const asset of assetList) {
      const fromCurrency = (asset.currency || 'USD') as CurrencyCode;
      let value = asset.market_value; // 注意字段名映射：数据库中为 market_value
      if (fromCurrency !== 'CNY') {
        value = await convertAmount(value, fromCurrency, 'CNY');
      }
      if (asset.type === 'liability') {
        totalLiabilities += Math.abs(value);
      } else {
        totalAssets += value;
      }
    }

    const netWorth = totalAssets - totalLiabilities;

    // 北京时间整点快照
    const now = new Date();
    const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const snapshotHour = new Date(beijingTime.getFullYear(), beijingTime.getMonth(), beijingTime.getDate(), beijingTime.getHours(), 0, 0);
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