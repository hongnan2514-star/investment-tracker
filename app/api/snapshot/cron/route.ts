// app/api/snapshot/cron/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { convertAmount } from '@/src/services/forex';
import { CurrencyCode } from '@/src/services/currency';

const sql = neon(process.env.POSTGRES_URL!);

export async function GET(request: NextRequest) {
  // 可选：增加一个简单的密钥验证，防止被恶意调用
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. 获取所有用户的 ID（假设 users 表中有 phone 字段作为 user_id）
    const users = await sql`SELECT phone FROM users`;
    
    const results = [];
    for (const user of users) {
      const userId = user.phone;
      
      // 2. 获取该用户的资产列表
      const assets = await sql`
        SELECT symbol, name, price, holdings, market_value, currency, type
        FROM assets WHERE user_id = ${userId}
      `;

      let totalAssets = 0;
      let totalLiabilities = 0;

      for (const asset of assets) {
        let value = Number(asset.market_value);
        if (isNaN(value)) continue;

        let fromCurrency = (asset.currency || 'USD').toUpperCase();
        if (fromCurrency === 'USDT') fromCurrency = 'USD';

        if (fromCurrency !== 'CNY') {
          try {
            value = await convertAmount(value, fromCurrency as CurrencyCode, 'CNY');
          } catch {
            continue;
          }
        }

        if (asset.type === 'liability') {
          totalLiabilities += Math.abs(value);
        } else {
          totalAssets += value;
        }
      }

      const netWorth = totalAssets - totalLiabilities;

      // 3. 生成北京时间整点时间戳
      const now = new Date();
      const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
      const snapshotHour = new Date(beijingTime.getFullYear(), beijingTime.getMonth(), beijingTime.getDate(), beijingTime.getHours(), 0, 0);
      const snapshotTimeUTC = new Date(snapshotHour.getTime() - 8 * 60 * 60 * 1000).toISOString();

      // 4. 写入快照（避免重复）
      const existing = await sql`
        SELECT id FROM snapshots WHERE user_id = ${userId} AND snapshot_time = ${snapshotTimeUTC}
      `;
      if (existing.length === 0) {
        await sql`
          INSERT INTO snapshots (user_id, snapshot_time, total_assets, total_liabilities, net_worth)
          VALUES (${userId}, ${snapshotTimeUTC}, ${totalAssets}, ${totalLiabilities}, ${netWorth})
        `;
        results.push({ userId, netWorth });
      }
    }

    return NextResponse.json({ success: true, processed: results.length });
  } catch (error) {
    console.error('[Cron快照] 错误:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
