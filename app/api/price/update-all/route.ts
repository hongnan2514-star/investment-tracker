// app/api/price/update-all
import { NextResponse } from 'next/server';
import { query } from '@/src/lib/db';
import { fetchPriceForAsset } from '@/src/services/priceService';
import {
  isUSMarketOpen,
  isAStockMarketOpen,
  isMetalMarketOpen,
} from '@/src/utils/marketTime';

const UPDATE_INTERVALS = {
  crypto: 15,
  fund: 24 * 60,
  stock: 1,
  etf: 1,
  metal: 1,
} as const;

// 判断资产是否应该更新
function shouldUpdateAsset(asset: any, now: Date): boolean {
  const { type, symbol, last_updated } = asset;
  const lastUpdate = last_updated ? new Date(last_updated) : null;

  if (type !== 'crypto' && type !== 'fund' && type !== 'stock' && type !== 'etf' && type !== 'metal') {
    return false;
  }

  const intervalMinutes = UPDATE_INTERVALS[type as keyof typeof UPDATE_INTERVALS];
  if (!intervalMinutes) return false;

  if (lastUpdate && (now.getTime() - lastUpdate.getTime()) < intervalMinutes * 60 * 1000) {
    return false;
  }

  if (type === 'stock' || type === 'etf') {
    if (symbol.includes('.SS') || symbol.includes('.SZ')) {
      return isAStockMarketOpen(now);
    } else if (symbol.includes('.HK')) {
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

  return true;
}

// 超时包装器
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

export async function POST(request: Request) {
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

    const assetsToUpdate = result.rows.filter(asset => shouldUpdateAsset(asset, now));
    if (assetsToUpdate.length === 0) {
      return NextResponse.json({ success: true, updated: 0 });
    }

    // 并发控制：每次处理 5 个资产（避免外部 API 限流）
    const BATCH_SIZE = 5;
    let updatedCount = 0;

    for (let i = 0; i < assetsToUpdate.length; i += BATCH_SIZE) {
      const batch = assetsToUpdate.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(async (asset) => {
          try {
            // 为每个价格获取设置 5 秒超时
            const priceData = await withTimeout(
              fetchPriceForAsset({ symbol: asset.symbol, type: asset.type }),
              5000
            );
            if (priceData && priceData.price != null && !isNaN(priceData.price)) {
              const newMarketValue = asset.holdings * priceData.price;
              await query(
                `UPDATE assets
                 SET price = $1, market_value = $2, last_updated = NOW()
                 WHERE id = $3`,
                [priceData.price, newMarketValue, asset.id]
              );
              return true;
            }
          } catch (err) {
            console.error(`更新资产 ${asset.symbol} 失败:`, err);
          }
          return false;
        })
      );
      updatedCount += batchResults.filter(r => r.status === 'fulfilled' && r.value === true).length;
    }

    console.log(`价格更新完成，更新了 ${updatedCount} 个资产`);
    return NextResponse.json({ success: true, updated: updatedCount });
  } catch (error) {
    console.error('价格更新失败:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}