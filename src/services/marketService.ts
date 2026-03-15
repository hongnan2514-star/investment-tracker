// src/services/marketService.ts
import { Asset } from '@/src/constants/types';
import { eventBus } from '@/src/utils/eventBus';
import { getAssets, getCurrentUserId } from '@/src/utils/assetStorage';
import { recordSnapshot } from './historyService';
import { queryCryptoOHLCV } from '@/app/api/data-sources/crypto-ccxt';

// 判断美股当前是否处于交易时段（基于北京时间）
function isUSMarketOpen(): boolean {
  const now = new Date();

  const day = now.getDay();
  if (day === 0 || day === 6) return false;

  const year = now.getFullYear();
  const marchSecondSunday = (() => {
    const date = new Date(year, 2, 1);
    let sundayCount = 0;
    for (let d = 1; d <= 14; d++) {
      const dte = new Date(year, 2, d);
      if (dte.getDay() === 0) {
        sundayCount++;
        if (sundayCount === 2) return new Date(year, 2, d);
      }
    }
    return new Date(year, 2, 14);
  })();

  const novFirstSunday = (() => {
    const date = new Date(year, 10, 1);
    for (let d = 1; d <= 7; d++) {
      const dte = new Date(year, 10, d);
      if (dte.getDay() === 0) return new Date(year, 10, d);
    }
    return new Date(year, 10, 7);
  })();

  const isDST = now >= marchSecondSunday && now < novFirstSunday;
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const currentTime = hours + minutes / 60;

  if (isDST) {
    return currentTime >= 21.5 || currentTime < 4;
  } else {
    return currentTime >= 22.5 || currentTime < 5;
  }
}

export async function refreshAllAssets(assets: Asset[]): Promise<Asset[]> {
  if (assets.length === 0) return assets;

  const currentAssets = getAssets();
  const currentSymbols = new Set(currentAssets.map(a => a.symbol));
  const validAssets = assets.filter(asset => currentSymbols.has(asset.symbol));

  if (validAssets.length === 0) return currentAssets;

  const priceMap = new Map();

  await Promise.all(validAssets.map(async (asset) => {
    if (asset.type === 'crypto') {
      try {
        const res = await fetch(`/api/crypto/minute?symbol=${encodeURIComponent(asset.symbol)}&resolution=5m&limit=2`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0) {
            const latest = data[0];
            let changePercent = 0;
            if (data.length >= 2) {
              const previous = data[1];
              if (previous.close > 0) {
                changePercent = ((latest.close - previous.close) / previous.close) * 100;
              }
            }
            priceMap.set(asset.symbol, { price: latest.close, changePercent });
          }
        }
      } catch (error) {
        console.error(`[加密货币] ${asset.symbol} 更新失败:`, error);
      }
    } else if (asset.type === 'stock' || asset.type === 'etf') {
      if (!isUSMarketOpen()) return;
      try {
        const response = await fetch(`/api/search?symbol=${encodeURIComponent(asset.symbol)}`);
        const data = await response.json();
        if (data.price) {
          priceMap.set(asset.symbol, { price: data.price, changePercent: data.changePercent || 0 });
        }
      } catch (error) {
        console.error(`[股票] ${asset.symbol} 更新失败:`, error);
      }
    } else if (asset.type === 'fund') {
  try {
    // 调用专用 API 获取最新净值，注意传递不带后缀的代码
    const response = await fetch(`/api/fund/latest?code=${encodeURIComponent(asset.symbol.replace(/\.OF$/, ''))}`);
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.price) {
        priceMap.set(asset.symbol, { price: data.price, changePercent: data.changePercent || 0 });
      } else {
        // 如果 API 成功但无数据，使用现有资产价格（不更新）
        console.log(`[基金] ${asset.symbol} 暂无最新净值，使用现有价格`);
      }
    } else {
      // API 失败，记录错误但不回退到搜索
      console.error(`[基金] ${asset.symbol} 最新净值API失败: ${response.status}`);
    }
  } catch (error) {
    console.error(`[基金] ${asset.symbol} 更新失败:`, error);
  }
} else if (asset.type === 'metal') {
  try {
    const response = await fetch(`/api/metal/latest?code=${encodeURIComponent(asset.symbol)}`);
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.price != null) {
        priceMap.set(asset.symbol, { 
          price: Number(data.price),          // 强制转换为数字
          changePercent: Number(data.changePercent) || 0 
        });
      } else {
        console.log(`[贵金属] ${asset.symbol} 暂无最新价格，使用现有价格`);
      }
    } else {
      console.error(`[贵金属] ${asset.symbol} 最新价格API失败: ${response.status}`);
    }
  } catch (error) {
    console.error(`[贵金属] ${asset.symbol} 更新失败:`, error);
  }
} else if (asset.type === 'car' || asset.type === 'real_estate' || asset.type === 'custom') {
  return;
} else {
    // 其他类型（汽车、房产等）使用搜索接口
    try {
      const response = await fetch(`/api/search?symbol=${encodeURIComponent(asset.symbol)}`);
      const data = await response.json();
      if (data.price) {
        priceMap.set(asset.symbol, { price: data.price, changePercent: data.changePercent || 0 });
      }
    } catch (error) {
      console.error(`[其他] ${asset.symbol} 更新失败:`, error);
    }
  }
}));

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

  const userId = getCurrentUserId();
  const assetsKey = userId ? `assets_${userId}` : null;

  if (assetsKey) {
    const currentData = localStorage.getItem(assetsKey);
    let allAssets: Asset[] = currentData ? JSON.parse(currentData) : [];
    allAssets = allAssets.map(asset => {
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
    localStorage.setItem(assetsKey, JSON.stringify(allAssets));
    getAssets(); // 更新内存缓存
  }

  // 清理旧格式资产
  const allKeys = Object.keys(localStorage);
  allKeys.forEach(key => {
    if (key.startsWith('asset_')) {
      const symbol = key.replace('asset_', '');
      if (!currentSymbols.has(symbol)) {
        localStorage.removeItem(key);
      }
    }
  });

  if (updatedAssets.length > 0) recordSnapshot();

  // 后台异步更新历史数据
  updatedAssets.forEach(asset => {
    if (asset.type === 'crypto') {
      const resolution = '5m';
      fetch(`/api/crypto/needs-update?symbol=${encodeURIComponent(asset.symbol)}&resolution=${resolution}&maxAge=300`)
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
              resolution,
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

  eventBus.emit('assetsUpdated', updatedAssets);
  return updatedAssets;
}