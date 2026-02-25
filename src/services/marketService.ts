// src/services/marketService.ts
import { Asset } from '@/src/constants/types';
import { eventBus } from '@/src/utils/eventBus';
import { getAssets } from '@/src/utils/assetStorage';
import { recordSnapshot } from './historyService';
import { queryCryptoOHLCV } from '@/app/api/data-sources/crypto-ccxt';

export async function refreshAllAssets(assets: Asset[]): Promise<Asset[]> {
  if (assets.length === 0) return assets;

  const currentAssets = getAssets();
  const currentSymbols = new Set(currentAssets.map(a => a.symbol));

  const validAssets = assets.filter(asset => currentSymbols.has(asset.symbol));

  if (validAssets.length === 0) {
    return currentAssets;
  }

  const priceMap = new Map();

  // 并发获取所有资产的最新价格
  await Promise.all(validAssets.map(async (asset) => {
    if (asset.type === 'crypto') {
      // 加密货币：从数据库分钟级历史获取最新价格和涨跌幅
      try {
        // 请求2条数据（limit=2）以便计算涨跌幅
        const res = await fetch(`/api/crypto/minute?symbol=${encodeURIComponent(asset.symbol)}&resolution=5m&limit=2`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0) {
            const latest = data[0]; // 最新一条（按timestamp DESC）
            let changePercent = 0;
            // 如果有前一条数据，计算涨跌幅
            if (data.length >= 2) {
              const previous = data[1];
              if (previous.close > 0) {
                changePercent = ((latest.close - previous.close) / previous.close) * 100;
              }
            }
            priceMap.set(asset.symbol, {
              price: latest.close,
              changePercent: changePercent, // 基于前一条的涨跌幅
            });
            console.log(`[分钟价格] ${asset.symbol} 最新收盘价: ${latest.close}, 涨跌幅: ${changePercent.toFixed(2)}%`);
          } else {
            console.warn(`[分钟价格] ${asset.symbol} 无分钟数据`);
          }
        } else {
          console.warn(`[分钟价格] API 请求失败: ${res.status}`);
        }
      } catch (error) {
        console.error(`[分钟价格] 获取 ${asset.symbol} 失败:`, error);
      }
    } else {
      // 非加密货币：原有实时查询（股票、基金等）
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

  // 6. 清理已删除资产的 storage 条目
  const allKeys = Object.keys(localStorage);
  allKeys.forEach(key => {
    if (key.startsWith('asset_')) {
      const symbol = key.replace('asset_', '');
      if (!currentSymbols.has(symbol)) {
        localStorage.removeItem(key);
      }
    }
  });

  // 7. 记录总资产快照
  if (updatedAssets.length > 0) {
    recordSnapshot();
  }

  // 8. 后台异步更新历史数据（通过 API）
  updatedAssets.forEach(asset => {
    if (asset.type === 'crypto') {
      const resolution = '5m';
      const maxAge = 5 * 60;
      fetch(`/api/crypto/needs-update?symbol=${encodeURIComponent(asset.symbol)}&resolution=${resolution}&maxAge=${maxAge}`)
        .then(res => res.json())
        .then(({ needsUpdate }) => {
          if (needsUpdate) {
            return queryCryptoOHLCV(asset.symbol.split('/')[0], resolution, 288);
          }
        })
        .then(data => {
          if (data && data.length > 0) {
            const records = data.map(item => ({
              symbol: asset.symbol,
              timestamp: item.timestamp,
              resolution: resolution,
              open: item.close,
              high: item.close,
              low: item.close,
              close: item.close,
              volume: 0,
            }));
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