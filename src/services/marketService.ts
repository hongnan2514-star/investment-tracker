// src/services/marketService.ts
import { Asset } from '@/src/constants/types';
import { eventBus } from '@/src/utils/eventBus';
import { getAssets } from '@/src/utils/assetStorage';
import { recordSnapshot } from './historyService';
import { queryCryptoOHLCV } from '@/app/api/data-sources/crypto-ccxt';

// ⚠️ 注意：不再导入 needsCryptoMinuteUpdate 和 saveCryptoMinute，改为通过 API 调用

export async function refreshAllAssets(assets: Asset[]): Promise<Asset[]> {
  if (assets.length === 0) return assets;

  // 1. 获取最新的资产列表（确保实时性）
  const currentAssets = getAssets();
  const currentSymbols = new Set(currentAssets.map(a => a.symbol));

  // 2. 只刷新当前真正存在的资产
  const validAssets = assets.filter(asset => currentSymbols.has(asset.symbol));

  if (validAssets.length === 0) {
    return currentAssets;
  }

  const priceMap = new Map();

  // 3. 并发请求所有资产的最新价格
  await Promise.all(validAssets.map(async (asset) => {
    try {
      const response = await fetch(`/api/search?symbol=${encodeURIComponent(asset.symbol)}`);
      const data = await response.json();

      if (data.price) {
        priceMap.set(asset.symbol, {
          price: data.price,
          changePercent: data.changePercent || 0
        });
      }
    } catch (error) {
      console.error(`更新 ${asset.symbol} 失败:`, error);
    }
  }));

  // 4. 基于当前真实的资产列表进行更新
  const updatedAssets = currentAssets.map(asset => {
    const update = priceMap.get(asset.symbol);
    if (update) {
      return {
        ...asset,
        price: update.price,
        changePercent: update.changePercent,
        marketValue: asset.holdings * update.price,
        lastUpdated: new Date().toISOString()
      };
    }
    return asset;
  });

  // 5. 批量更新 localStorage
  updatedAssets.forEach(asset => {
    localStorage.setItem(`asset_${asset.symbol}`, JSON.stringify(asset));
  });

  // 6. 清理可能残留的已删除资产的 storage 条目
  const allKeys = Object.keys(localStorage);
  allKeys.forEach(key => {
    if (key.startsWith('asset_')) {
      const symbol = key.replace('asset_', '');
      if (!currentSymbols.has(symbol)) {
        localStorage.removeItem(key);
      }
    }
  });

  // 7. 在所有资产更新成功后，记录总资产快照（用于走势图）
  if (updatedAssets.length > 0) {
    recordSnapshot();
  }

  // 8. 在后台异步更新历史数据（通过 API，不阻塞主流程）
  updatedAssets.forEach(asset => {
    // ---------- 加密货币分钟级数据更新（改为 API 方式）----------
    if (asset.type === 'crypto') {
      const resolution = '5m';  // 可根据需要改为 '15m'
      const maxAge = 5 * 60;    // 5分钟（与分辨率一致）

      // 先通过 API 检查是否需要更新
      fetch(`/api/crypto/needs-update?symbol=${encodeURIComponent(asset.symbol)}&resolution=${resolution}&maxAge=${maxAge}`)
        .then(res => res.json())
        .then(({ needsUpdate }) => {
          if (needsUpdate) {
            // 获取最新分钟数据
            return queryCryptoOHLCV(asset.symbol.split('/')[0], resolution, 288);
          }
        })
        .then(data => {
          if (data && data.length > 0) {
            const records = data.map(item => ({
              symbol: asset.symbol,
              timestamp: item.timestamp,
              resolution: resolution,
              open: item.close,   // 如果将来有真实 OHLC，可替换
              high: item.close,
              low: item.close,
              close: item.close,
              volume: 0,
            }));
            // 通过 API 保存到数据库
            return fetch('/api/crypto/minute', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(records)
            });
          }
        })
        .then(res => {
          if (res && res.ok) {
            console.log(`[分钟历史] 已更新 ${asset.symbol} ${resolution} 数据`);
          }
        })
        .catch(err => console.error(`更新分钟历史失败 ${asset.symbol}:`, err));
    }

    // ---------- 原有的日线/股票历史更新（保持不变）----------
    if (asset.type === 'stock' || asset.type === 'etf' || asset.type === 'crypto') {
      fetch('/api/history/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset })
      }).catch(err => console.error(`后台历史更新请求失败 ${asset.symbol}:`, err));
    }
  });

  // 9. 通知所有组件资产已更新
  eventBus.emit('assetsUpdated', updatedAssets);

  return updatedAssets;
}