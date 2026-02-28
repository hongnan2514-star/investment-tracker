// src/utils/assetStorage.ts
import { Asset } from '@/src/constants/types';
import { eventBus } from './eventBus';

// 内存缓存 Map，键为资产 symbol，值为资产对象
let assetsMap: Map<string, Asset> | null = null;
let currentUserId: string | null = null;

// 同步锁，避免并发同步
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
  assetsMap = null; // 清空缓存
  // 触发用户切换事件
  eventBus.emit('userChanged', userId);
  // 如果新用户登录，从云端拉取资产
  if (userId) {
    await pullAssetsFromCloud(userId);
  }
};

// 从云端拉取资产
async function pullAssetsFromCloud(userId: string): Promise<void> {
  try {
    const res = await fetch(`/api/user/assets?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) throw new Error('拉取失败');
    const { assets } = await res.json();
    // 存入本地存储和缓存
    const assetsKey = `assets_${userId}`;
    localStorage.setItem(assetsKey, JSON.stringify(assets));
    assetsMap = new Map(assets.map((asset: Asset) => [asset.symbol, asset]));
    console.log('已从云端同步资产');
  } catch (error) {
    console.error('拉取云端资产失败:', error);
  }
}

// 推送到云端
async function pushAssetsToCloud(userId: string, assets: Asset[]): Promise<void> {
  try {
    await fetch('/api/user/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, assets }),
    });
  } catch (error) {
    console.error('推送资产到云端失败:', error);
  }
}

// 获取本地存储键
function getAssetsKey(): string | null {
  const userId = getCurrentUserId();
  return userId ? `assets_${userId}` : null;
}

// 加载资产到内存缓存（从本地存储）
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
  if (!assetsMap) {
    loadAssetsMap();
  }
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

// 同步资产到本地和云端
async function syncAssets(updatedAssets: Asset[]) {
  const userId = getCurrentUserId();
  if (!userId) return;

  const assetsKey = `assets_${userId}`;
  localStorage.setItem(assetsKey, JSON.stringify(updatedAssets));
  assetsMap = new Map(updatedAssets.map(asset => [asset.symbol, asset]));

  // 触发事件通知组件更新
  eventBus.emit('assetsUpdated');

  // 异步推送到云端（避免阻塞）
  if (!syncPromise) {
    syncPromise = pushAssetsToCloud(userId, updatedAssets).finally(() => {
      syncPromise = null;
    });
  }
}

export const addAsset = async (newAsset: Asset) => {
  if (typeof window === 'undefined') return;

  const userId = getCurrentUserId();
  if (!userId) {
    console.warn('请先登录');
    return;
  }

  const assets = getAssets();
  const existingIndex = assets.findIndex(asset => asset.symbol === newAsset.symbol);

  if (existingIndex !== -1) {
    const existing = assets[existingIndex];
    const totalHoldings = existing.holdings + newAsset.holdings;
    const totalCost = (existing.costPrice || 0) * existing.holdings + (newAsset.costPrice || 0) * newAsset.holdings;
    const avgCost = totalCost / totalHoldings;

    assets[existingIndex] = {
      ...existing,
      holdings: totalHoldings,
      costPrice: avgCost,
      purchaseDate: existing.purchaseDate && newAsset.purchaseDate
        ? (existing.purchaseDate < newAsset.purchaseDate ? existing.purchaseDate : newAsset.purchaseDate)
        : (existing.purchaseDate || newAsset.purchaseDate),
      marketValue: totalHoldings * existing.price,
    };
  } else {
    assets.push(newAsset);
  }

  await syncAssets(assets);
};

export const removeAsset = async (symbol: string) => {
  if (typeof window === 'undefined') return;

  const userId = getCurrentUserId();
  if (!userId) return;

  const assets = getAssets().filter(asset => asset.symbol !== symbol);
  await syncAssets(assets);
};

export const clearCurrentUserAssets = () => {
  const userId = getCurrentUserId();
  if (userId) {
    const assetsKey = `assets_${userId}`;
    localStorage.removeItem(assetsKey);
    assetsMap = null;
    // 可选：同时删除云端数据（调用 DELETE API）
  }
};