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

    // 优先使用传入的资产列表
    if (providedAssets && Array.isArray(providedAssets)) {
      assetList = providedAssets;
    } else {
      try {
        const result = await sql`
          SELECT symbol, name, price, holdings, market_value, currency, type, cost_price, purchase_date, notes, include_in_chart
          FROM assets WHERE user_id = ${userId}
        `;
        assetList = result;
      } catch (dbError) {
        console.error('[快照] 查询 assets 表失败:', dbError);
        throw new Error(`数据库查询失败: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
      }
    }

    // 无资产，净值为 0
    if (assetList.length === 0) {
      const netWorth = 0;
      const now = new Date();
      const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
      const snapshotHour = new Date(beijingTime.getFullYear(), beijingTime.getMonth(), beijingTime.getDate(), beijingTime.getHours(), 0, 0);
      const snapshotTimeUTC = new Date(snapshotHour.getTime() - 8 * 60 * 60 * 1000).toISOString();

      try {
        const existing = await sql`
          SELECT id FROM snapshots WHERE user_id = ${userId} AND snapshot_time = ${snapshotTimeUTC}
        `;
        if (existing.length === 0) {
          await sql`
            INSERT INTO snapshots (user_id, snapshot_time, total_assets, total_liabilities, net_worth)
            VALUES (${userId}, ${snapshotTimeUTC}, 0, 0, 0)
          `;
        }
      } catch (dbError) {
        console.error('[快照] 写入零值快照失败:', dbError);
        // 不中断流程，仅记录错误
      }
      return NextResponse.json({ success: true, totalAssets: 0, totalLiabilities: 0, netWorth: 0 });
    }

    let totalAssets = 0;
    let totalLiabilities = 0;

    for (const asset of assetList) {
      try {
        let value = asset.market_value;
        if (value == null || isNaN(Number(value))) {
          console.warn(`[快照] 资产 ${asset.symbol} 的 market_value 无效: ${value}，跳过`);
          continue;
        }
        value = Number(value);

        let fromCurrency = (asset.currency || 'USD').toUpperCase();
        if (fromCurrency === 'USDT') fromCurrency = 'USD';

        // 货币转换
        if (fromCurrency !== 'CNY') {
          try {
            value = await convertAmount(value, fromCurrency as CurrencyCode, 'CNY');
            if (isNaN(value)) {
              console.error(`[快照] 资产 ${asset.symbol} 货币转换后为 NaN，跳过`);
              continue;
            }
          } catch (convertErr) {
            console.error(`[快照] 资产 ${asset.symbol} 货币转换失败:`, convertErr);
            continue;
          }
        }

        // 累加
        if (asset.type === 'liability') {
          totalLiabilities += Math.abs(value);
        } else {
          totalAssets += value;
        }
      } catch (assetErr) {
        console.error(`[快照] 处理资产 ${asset.symbol} 时发生未知错误:`, assetErr);
        // 继续处理下一个资产
      }
    }

    const netWorth = totalAssets - totalLiabilities;

    // 北京时间整点快照
    const now = new Date();
    const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const snapshotHour = new Date(beijingTime.getFullYear(), beijingTime.getMonth(), beijingTime.getDate(), beijingTime.getHours(), 0, 0);
    const snapshotTimeUTC = new Date(snapshotHour.getTime() - 8 * 60 * 60 * 1000).toISOString();

    try {
      const existing = await sql`
        SELECT id FROM snapshots WHERE user_id = ${userId} AND snapshot_time = ${snapshotTimeUTC}
      `;
      if (existing.length === 0) {
        await sql`
          INSERT INTO snapshots (user_id, snapshot_time, total_assets, total_liabilities, net_worth)
          VALUES (${userId}, ${snapshotTimeUTC}, ${totalAssets}, ${totalLiabilities}, ${netWorth})
        `;
      }
    } catch (dbError) {
      console.error('[快照] 写入快照失败:', dbError);
      throw new Error(`快照写入失败: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
    }

    return NextResponse.json({ success: true, totalAssets, totalLiabilities, netWorth });
  } catch (error) {
    console.error('[快照API] 全局捕获错误:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}