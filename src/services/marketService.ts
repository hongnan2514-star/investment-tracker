// src/services/marketService.ts
import { Asset } from '@/src/constants/types';
import { eventBus } from '@/src/utils/eventBus';
import { getAssets, getCurrentUserId } from '@/src/utils/assetStorage';
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
      try {
        const res = await fetch(`/api/crypto/minute?symbol=${encodeURIComponent(asset.symbol)}&resolution=5m&limit=2`);
        console.log(`[价格调试] ${asset.symbol} API 响应状态:`, res.status);
        
        if (res.ok) {
          const data = await res.json();
          console.log(`[价格调试] ${asset.symbol} API 返回数据:`, data);
          
          if (data && data.length > 0) {
            const latest = data[0];
            console.log(`[价格调试] ${asset.symbol} 最新价格:`, latest.close, '原价格:', asset.price);
            
            let changePercent = 0;
            if (data.length >= 2) {
              const previous = data[1];
              if (previous.close > 0) {
                changePercent = ((latest.close - previous.close) / previous.close) * 100;
              }
            }
            
            priceMap.set(asset.symbol, {
              price: latest.close,
              changePercent: changePercent,
            });
            console.log(`[价格调试] ${asset.symbol} 已设置新价格:`, latest.close);
          } else {
            console.warn(`[价格调试] ${asset.symbol} 无分钟数据`);
          }
        } else {
          console.warn(`[价格调试] ${asset.symbol} API 请求失败: ${res.status}`);
        }
      } catch (error) {
        console.error(`[价格调试] ${asset.symbol} 获取失败:`, error);
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
      console.log(`[写入调试] 准备更新 ${asset.symbol}:`, {
        旧价: asset.price,
        新价: update.price,
        旧市值: asset.marketValue,
        新市值: asset.holdings * update.price
      });
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

  // 5. 获取正确的存储键并更新主存储（关键修复）
  const userId = getCurrentUserId();
  const assetsKey = userId ? `assets_${userId}` : null;

  if (assetsKey) {
    console.log('[写入调试] 开始更新主存储，key:', assetsKey);
    
    // 读取当前所有资产
    const currentData = localStorage.getItem(assetsKey);
    let allAssets: Asset[] = currentData ? JSON.parse(currentData) : [];
    
    console.log('[写入调试] 更新前所有资产:', allAssets.map(a => ({ symbol: a.symbol, price: a.price })));
    
    // 使用 priceMap 更新资产价格
    allAssets = allAssets.map(asset => {
      const update = priceMap.get(asset.symbol);
      if (update) {
        console.log(`[写入调试] 更新 ${asset.symbol}:`, {
          旧价: asset.price,
          新价: update.price,
          旧市值: asset.marketValue,
          新市值: asset.holdings * update.price
        });
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
    
    // 写回主存储
    localStorage.setItem(assetsKey, JSON.stringify(allAssets));
    console.log('[写入调试] 已更新主存储，新数据:', allAssets.map(a => ({ symbol: a.symbol, price: a.price })));
    
    // 验证写入
    const verify = localStorage.getItem(assetsKey);
    console.log('[写入调试] 验证主存储:', verify ? JSON.parse(verify).map((a: any) => ({ symbol: a.symbol, price: a.price })) : '失败');
    
    // 更新缓存（通过 getAssets 会自动更新）
    getAssets();
  } else {
    console.warn('[写入调试] 无法获取用户ID，跳过存储');
  }

  // 6. 清理已删除资产的 storage 条目（注意：这里只清理旧的单条存储格式）
  const allKeys = Object.keys(localStorage);
  allKeys.forEach(key => {
    if (key.startsWith('asset_')) {
      const symbol = key.replace('asset_', '');
      if (!currentSymbols.has(symbol)) {
        localStorage.removeItem(key);
        console.log(`[写入调试] 清理旧格式资产: ${key}`);
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

  console.log('[价格调试] 最终更新的资产:',
    updatedAssets.map(a => ({
      symbol: a.symbol,
      price: a.price,
      marketValue: a.marketValue
    }))
  );

  return updatedAssets;
}