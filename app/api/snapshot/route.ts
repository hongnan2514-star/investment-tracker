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
      // 1. 检查 market_value 是否有效
      let value = asset.market_value;
      if (value == null || isNaN(Number(value))) {
        console.warn(`[快照] 资产 ${asset.symbol} 的 market_value 无效: ${value}，跳过`);
        continue;
      }
      value = Number(value);

      // 2. 处理货币
      let fromCurrency = (asset.currency || 'USD').toUpperCase();
      // 将 USDT 映射为 USD，因为汇率服务不支持 USDT
      if (fromCurrency === 'USDT') fromCurrency = 'USD';

      // 3. 转换到 CNY（如果需要）
      if (fromCurrency !== 'CNY') {
        try {
          value = await convertAmount(value, fromCurrency as CurrencyCode, 'CNY');
          if (isNaN(value)) {
            console.error(`[快照] 资产 ${asset.symbol} 货币转换后为 NaN，跳过`);
            continue;
          }
        } catch (err) {
          console.error(`[快照] 资产 ${asset.symbol} 货币转换失败:`, err);
          continue;
        }
      }

      // 4. 累加
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