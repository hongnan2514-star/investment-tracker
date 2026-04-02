// src/utils/assetStorage.ts
import { Asset } from '@/src/constants/types';
import { eventBus } from './eventBus';

let assetsMap: Map<string, Asset> | null = null;
let currentUserId: string | null = null;
let syncPromise: Promise<void> | null = null;

export const getCurrentUserId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('currentUserId');
};

export const setCurrentUserId = async (userId: string | null) => {
  if (typeof window === 'undefined') return;
  if (userId) {
    localStorage.setItem('currentUserId', userId);
  } else {
    localStorage.removeItem('currentUserId');
  }
  currentUserId = userId;
  assetsMap = null;
  eventBus.emit('userChanged', userId);
  if (userId) {
    await pullAssetsFromCloud(userId);
  }
};

// 从云端拉取资产（使用 /api/asset）
async function pullAssetsFromCloud(userId: string): Promise<void> {
  try {
    const res = await fetch('/api/asset', {
      headers: { 'x-user-id': userId },
    });
    if (!res.ok) throw new Error('拉取失败');
    const assets = await res.json();
    const assetsKey = `assets_${userId}`;
    localStorage.setItem(assetsKey, JSON.stringify(assets));
    assetsMap = new Map(assets.map((asset: Asset) => [asset.symbol, asset]));
    console.log('已从云端同步资产');
  } catch (error) {
    console.error('拉取云端资产失败:', error);
  }
}

// 推送到云端（单个资产更新/新增）
async function pushAssetToCloud(userId: string, asset: Asset): Promise<boolean> {
  try {
    // 先尝试更新（PUT）
    const putRes = await fetch('/api/asset', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
      body: JSON.stringify({
        symbol: asset.symbol,
        holdings: asset.holdings,
        costPrice: asset.costPrice,
        marketValue: asset.marketValue,
      }),
    });

    if (putRes.ok) {
      return true; // 更新成功
    }

    if (putRes.status === 404) {
      // 资产不存在，执行新增
      const postRes = await fetch('/api/asset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({
          symbol: asset.symbol,
          name: asset.name,
          price: asset.price,
          holdings: asset.holdings,
          marketValue: asset.marketValue,
          currency: asset.currency,
          type: asset.type,
          purchaseDate: asset.purchaseDate,
          costPrice: asset.costPrice,
          notes: asset.notes,
          includeInChart: asset.includeInChart,
          logoUrl: asset.logoUrl,
        }),
      });
      if (!postRes.ok) {
        const errorText = await postRes.text();
        console.error('新增资产失败，响应:', errorText);
        throw new Error('新增资产失败');
      }
      return true;
    }

    // 其他错误
    const errorText = await putRes.text();
    console.error('更新资产失败，状态码:', putRes.status, errorText);
    return false;
  } catch (error) {
    console.error('推送资产到云端失败:', error);
    return false;
  }
}

function getAssetsKey(): string | null {
  const userId = getCurrentUserId();
  return userId ? `assets_${userId}` : null;
}

function loadAssetsMap(): void {
  const assetsKey = getAssetsKey();
  if (!assetsKey) {
    assetsMap = new Map();
    return;
  }
  const data = localStorage.getItem(assetsKey);
  if (!data) {
    assetsMap = new Map();
    return;
  }
  try {
    const assets = JSON.parse(data) as Asset[];
    const cleanedAssets = assets.map(asset => ({
      ...asset,
      type: asset.type || 'stock',
      purchaseDate: asset.purchaseDate,
      costPrice: asset.costPrice,
    }));
    assetsMap = new Map(cleanedAssets.map(asset => [asset.symbol, asset]));
  } catch (error) {
    console.error('Invalid asset data:', error);
    localStorage.removeItem(assetsKey);
    assetsMap = new Map();
  }
}

export function getAssetBySymbol(symbol: string): Asset | null {
  if (!assetsMap) loadAssetsMap();
  return assetsMap?.get(symbol) || null;
}

export const getAssets = (): Asset[] => {
  if (typeof window === 'undefined') return [];
  const assetsKey = getAssetsKey();
  if (!assetsKey) return [];
  const data = localStorage.getItem(assetsKey);
  if (!data) return [];
  try {
    const assets = JSON.parse(data) as Asset[];
    const cleanedAssets = assets.map(asset => ({
      ...asset,
      type: asset.type || 'stock',
      purchaseDate: asset.purchaseDate,
      costPrice: asset.costPrice,
    }));
    assetsMap = new Map(cleanedAssets.map(asset => [asset.symbol, asset]));
    return cleanedAssets;
  } catch (error) {
    console.error('Invalid asset data:', error);
    localStorage.removeItem(assetsKey);
    assetsMap = null;
    return [];
  }
};

// 同步资产到本地和云端（供 addAsset 调用）
async function syncAssets(updatedAssets: Asset[]) {
  const userId = getCurrentUserId();
  if (!userId) return;

  const assetsKey = `assets_${userId}`;
  localStorage.setItem(assetsKey, JSON.stringify(updatedAssets));
  assetsMap = new Map(updatedAssets.map(asset => [asset.symbol, asset]));

  eventBus.emit('assetsUpdated');

  // 异步推送到云端（可选，但 addAsset 内部已单独推送，此处可保留用于其他场景）
  if (!syncPromise) {
    // 注意：syncAssets 可能被多处调用，此处简化，实际建议 addAsset 中单独处理
  }
}

// ✅ 核心修改：加仓/卖出时调用此方法，它会先更新数据库，再更新本地缓存
export const addAsset = async (newAsset: Asset) => {
  if (typeof window === 'undefined') return;

  const userId = getCurrentUserId();
  if (!userId) {
    console.warn('请先登录');
    return;
  }

  // 1. 先调用后端 API 更新数据库（PUT 或 POST）
  const success = await pushAssetToCloud(userId, newAsset);
  if (!success) {
    console.error('云端更新失败，本地将不会更新');
    return;
  }

  // 2. 后端更新成功后，再更新本地缓存和 localStorage
  const assets = getAssets();
  const existingIndex = assets.findIndex(asset => asset.symbol === newAsset.symbol);

  if (existingIndex !== -1) {
    // 更新现有资产
    assets[existingIndex] = { ...newAsset };
  } else {
    // 新增资产
    assets.push(newAsset);
  }

  const assetsKey = `assets_${userId}`;
  localStorage.setItem(assetsKey, JSON.stringify(assets));
  assetsMap = new Map(assets.map(asset => [asset.symbol, asset]));

  // 3. 触发全局更新事件
  eventBus.emit('assetsUpdated');
};

export const removeAsset = async (symbol: string) => {
  if (typeof window === 'undefined') return;
  const userId = getCurrentUserId();
  if (!userId) return;

  // 先调用后端删除
  try {
    const res = await fetch('/api/asset', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
      body: JSON.stringify({ symbol }),
    });
    if (!res.ok) throw new Error('删除失败');
  } catch (error) {
    console.error('删除云端资产失败:', error);
    return;
  }

  // 再更新本地
  const assets = getAssets().filter(asset => asset.symbol !== symbol);
  const assetsKey = `assets_${userId}`;
  localStorage.setItem(assetsKey, JSON.stringify(assets));
  assetsMap = new Map(assets.map(asset => [asset.symbol, asset]));
  eventBus.emit('assetsUpdated');
};

export const clearCurrentUserAssets = () => {
  const userId = getCurrentUserId();
  if (userId) {
    const assetsKey = `assets_${userId}`;
    localStorage.removeItem(assetsKey);
    assetsMap = null;
  }
};