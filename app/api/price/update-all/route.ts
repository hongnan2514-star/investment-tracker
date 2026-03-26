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

// 判断资产是否应该更新（添加详细日志）
function shouldUpdateAsset(asset: any, now: Date): boolean {
  const { type, symbol, last_updated } = asset;
  const lastUpdate = last_updated ? new Date(last_updated) : null;

  console.log(`[shouldUpdateAsset] 检查资产: ${symbol}, type=${type}, last_updated=${last_updated}`);

  if (type !== 'crypto' && type !== 'fund' && type !== 'stock' && type !== 'etf' && type !== 'metal') {
    console.log(`[shouldUpdateAsset] ❌ 跳过: 类型 ${type} 不在支持列表中`);
    return false;
  }

  const intervalMinutes = UPDATE_INTERVALS[type as keyof typeof UPDATE_INTERVALS];
  if (!intervalMinutes) {
    console.log(`[shouldUpdateAsset] ❌ 跳过: 无更新间隔配置 (type=${type})`);
    return false;
  }

  if (lastUpdate) {
    const diffMs = now.getTime() - lastUpdate.getTime();
    const diffMinutes = diffMs / (60 * 1000);
    console.log(`[shouldUpdateAsset] 距上次更新: ${diffMinutes.toFixed(2)} 分钟，要求间隔: ${intervalMinutes} 分钟`);
    if (diffMs < intervalMinutes * 60 * 1000) {
      console.log(`[shouldUpdateAsset] ❌ 跳过: 未到更新间隔`);
      return false;
    }
  } else {
    console.log(`[shouldUpdateAsset] 无上次更新时间，将更新`);
  }

  // 交易时段判断
  if (type === 'stock' || type === 'etf') {
    if (symbol.includes('.SS') || symbol.includes('.SZ')) {
      const open = isAStockMarketOpen(now);
      console.log(`[shouldUpdateAsset] A股交易时段: ${open}`);
      return open;
    } else if (symbol.includes('.HK')) {
      const day = now.getDay();
      if (day === 0 || day === 6) return false;
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const current = hours * 60 + minutes;
      const open = (current >= 9 * 60 + 30 && current <= 12 * 60) ||
                   (current >= 13 * 60 && current <= 16 * 60);
      console.log(`[shouldUpdateAsset] 港股交易时段: ${open}`);
      return open;
    } else {
      const open = isUSMarketOpen(now);
      console.log(`[shouldUpdateAsset] 美股交易时段: ${open}`);
      return open;
    }
  }

  if (type === 'metal') {
    const open = isMetalMarketOpen(now);
    console.log(`[shouldUpdateAsset] 贵金属交易时段: ${open}`);
    return open;
  }

  console.log(`[shouldUpdateAsset] ✅ 允许更新 (类型 ${type})`);
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

    console.log(`[PriceUpdate] 从数据库获取到 ${result.rows.length} 个资产:`);
    result.rows.forEach(asset => {
      console.log(`  - ${asset.symbol} (${asset.type}) last_updated=${asset.last_updated}`);
    });

    // 过滤需要更新的资产
    const assetsToUpdate = result.rows.filter(asset => shouldUpdateAsset(asset, now));
    console.log(`[PriceUpdate] 需要更新的资产数量: ${assetsToUpdate.length}`);
    if (assetsToUpdate.length > 0) {
      assetsToUpdate.forEach(asset => {
        console.log(`  [待更新] ${asset.symbol} (${asset.type})`);
      });
    }

    if (assetsToUpdate.length === 0) {
      return NextResponse.json({ success: true, updated: 0 });
    }

    // 并发控制：每次处理 5 个资产
    const BATCH_SIZE = 5;
    let updatedCount = 0;

    for (let i = 0; i < assetsToUpdate.length; i += BATCH_SIZE) {
      const batch = assetsToUpdate.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(async (asset) => {
          try {
            console.log(`[PriceUpdate] 开始获取 ${asset.symbol} (${asset.type}) 价格...`);
            const priceData = await withTimeout(
              fetchPriceForAsset({ symbol: asset.symbol, type: asset.type }),
              5000
            );
            if (priceData && priceData.price != null && !isNaN(priceData.price)) {
              console.log(`[PriceUpdate] ✅ ${asset.symbol} 新价格: ${priceData.price}`);
              const newMarketValue = asset.holdings * priceData.price;
              await query(
                `UPDATE assets
                 SET price = $1, market_value = $2, last_updated = NOW()
                 WHERE id = $3`,
                [priceData.price, newMarketValue, asset.id]
              );
              return true;
            } else {
              console.warn(`[PriceUpdate] ⚠️ ${asset.symbol} 价格无效:`, priceData);
            }
          } catch (err) {
            console.error(`[PriceUpdate] ❌ 更新资产 ${asset.symbol} 失败:`, err);
          }
          return false;
        })
      );
      updatedCount += batchResults.filter(r => r.status === 'fulfilled' && r.value === true).length;
    }

    console.log(`[PriceUpdate] 价格更新完成，成功更新 ${updatedCount} 个资产`);
    return NextResponse.json({ success: true, updated: updatedCount });
  } catch (error) {
    console.error('[PriceUpdate] 整体失败:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}