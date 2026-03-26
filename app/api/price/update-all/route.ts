import { NextResponse } from 'next/server';
import { query } from '@/src/lib/db';
import { fetchPriceForAsset } from '@/src/services/priceService';
import {
  isUSMarketOpen,
  isAStockMarketOpen,
  isMetalMarketOpen,
} from '@/src/utils/marketTime';

// 更新间隔（分钟）
const UPDATE_INTERVALS = {
  crypto: 15,      // 加密货币每15分钟
  fund: 24 * 60,   // 基金每天一次
  stock: 1,        // 股票交易时段实时
  etf: 1,
  metal: 1,
} as const;

// 判断资产是否应该更新
function shouldUpdateAsset(asset: any, now: Date): boolean {
  const { type, symbol, last_updated } = asset;
  const lastUpdate = last_updated ? new Date(last_updated) : null;

  // 显式检查资产类型，让 TypeScript 推断为联合类型
  if (type !== 'crypto' && type !== 'fund' && type !== 'stock' && type !== 'etf' && type !== 'metal') {
    return false;
  }

  const intervalMinutes = UPDATE_INTERVALS[type as keyof typeof UPDATE_INTERVALS]; // 现在 type 是有效的键
  if (!intervalMinutes) return false;

  // 检查时间间隔
  if (lastUpdate && (now.getTime() - lastUpdate.getTime()) < intervalMinutes * 60 * 1000) {
    return false;
  }

  // 交易时段判断
  if (type === 'stock' || type === 'etf') {
    if (symbol.includes('.SS') || symbol.includes('.SZ')) {
      return isAStockMarketOpen(now);
    } else if (symbol.includes('.HK')) {
      // 港股交易时段（北京时间）
      const day = now.getDay();
      if (day === 0 || day === 6) return false;
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const current = hours * 60 + minutes;
      return (current >= 9 * 60 + 30 && current <= 12 * 60) ||
             (current >= 13 * 60 && current <= 16 * 60);
    } else {
      return isUSMarketOpen(now);
    }
  }

  if (type === 'metal') {
    return isMetalMarketOpen(now);
  }

  // 加密货币和基金不依赖交易时段
  return true;
}

export async function POST(request: Request) {
  // 验证 cron-job.org 请求
  const authHeader = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();

    // 获取所有需要更新的资产（排除静态类型）
    const result = await query(`
      SELECT id, user_id, symbol, type, holdings, last_updated, price
      FROM assets
      WHERE type NOT IN ('car', 'real_estate', 'custom', 'liability')
    `);

    let updatedCount = 0;

    for (const asset of result.rows) {
      if (!shouldUpdateAsset(asset, now)) continue;

      const priceData = await fetchPriceForAsset({
        symbol: asset.symbol,
        type: asset.type,
      });

      if (priceData && priceData.price != null && !isNaN(priceData.price)) {
        const newMarketValue = asset.holdings * priceData.price;
        await query(
          `UPDATE assets
           SET price = $1,
               market_value = $2,
               last_updated = NOW()
           WHERE id = $3`,
          [priceData.price, newMarketValue, asset.id]
        );
        updatedCount++;
      }
    }

    console.log(`价格更新完成，更新了 ${updatedCount} 个资产`);
    return NextResponse.json({ success: true, updated: updatedCount });
  } catch (error) {
    console.error('价格更新失败:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}