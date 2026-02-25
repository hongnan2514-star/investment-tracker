// src/utils/assetStorage.ts
import { Asset } from '@/src/constants/types';
import { eventBus } from './eventBus';

// 内存缓存 Map，键为资产 symbol，值为资产对象
let assetsMap: Map<string, Asset> | null = null;

export const getCurrentUserId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('currentUserId');
};

export const setCurrentUserId = (userId: string | null) => {
  if (typeof window === 'undefined') return;
  if (userId) {
    localStorage.setItem('currentUserId', userId);
  } else {
    localStorage.removeItem('currentUserId');
  }
  assetsMap = null; // 切换用户时清空缓存
  eventBus.emit('userChanged', userId);
};

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
    // 数据清洗（保持与 getAssets 一致）
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
    // 更新缓存
    assetsMap = new Map(cleanedAssets.map(asset => [asset.symbol, asset]));
    return cleanedAssets;
  } catch (error) {
    console.error('Invalid asset data:', error);
    localStorage.removeItem(assetsKey);
    assetsMap = null;
    return [];
  }
};

export const addAsset = (newAsset: Asset) => {
  if (typeof window === 'undefined') return;

  const assetsKey = getAssetsKey();
  if (!assetsKey) {
    console.warn('请先登录');
    return;
  }

  const assets = getAssets(); // 会自动更新缓存
  const existingIndex = assets.findIndex((asset: Asset) => asset.symbol === newAsset.symbol);

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

  localStorage.setItem(assetsKey, JSON.stringify(assets));
  // 更新缓存
  assetsMap = new Map(assets.map(asset => [asset.symbol, asset]));
  eventBus.emit('assetsUpdated');
};

export const removeAsset = (symbol: string) => {
  if (typeof window === 'undefined') return;

  const assetsKey = getAssetsKey();
  if (!assetsKey) return;

  const assets = getAssets().filter((asset: Asset) => asset.symbol !== symbol);
  localStorage.setItem(assetsKey, JSON.stringify(assets));
  // 更新缓存
  assetsMap = new Map(assets.map(asset => [asset.symbol, asset]));
  eventBus.emit('assetsUpdated');
};

export const clearCurrentUserAssets = () => {
  const assetsKey = getAssetsKey();
  if (assetsKey) {
    localStorage.removeItem(assetsKey);
    assetsMap = null;
  }
};