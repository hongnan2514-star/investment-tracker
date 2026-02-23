import { Asset } from '@/src/constants/types';
import { eventBus } from '@/src/utils/eventBus';
import { getAssets } from '@/src/utils/assetStorage';
import { recordSnapshot } from './historyService';

// 注意：不再导入数据库相关函数

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

  // 8. 在后台异步更新历史数据（通过API，不阻塞主流程）
  updatedAssets.forEach(asset => {
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