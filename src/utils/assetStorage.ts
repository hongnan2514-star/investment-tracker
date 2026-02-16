import { Asset } from '@/src/constants/types';
import { eventBus } from './eventBus';

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
  eventBus.emit('userChanged', userId);
};

const getAssetsKey = (): string | null => {
  const userId = getCurrentUserId();
  return userId ? `assets_${userId}` : null;
};

export const getAssets = (): Asset[] => {
  if (typeof window === 'undefined') return [];

  const assetsKey = getAssetsKey();
  if (!assetsKey) return [];

  const data = localStorage.getItem(assetsKey);
  if (!data) return [];

  try {
    const assets = JSON.parse(data) as Asset[];
    return assets.map(asset => ({
      ...asset,
      type: asset.type || 'stock',
      purchaseDate: asset.purchaseDate,
      costPrice: asset.costPrice,
    }));
  } catch (error) {
    console.error('Invalid asset data:', error);
    localStorage.removeItem(assetsKey);
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

  const assets = getAssets();
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
  eventBus.emit('assetsUpdated');
};

export const removeAsset = (symbol: string) => {
  if (typeof window === 'undefined') return;

  const assetsKey = getAssetsKey();
  if (!assetsKey) return;

  const assets = getAssets().filter((asset: Asset) => asset.symbol !== symbol);
  localStorage.setItem(assetsKey, JSON.stringify(assets));
  eventBus.emit('assetsUpdated');
};

export const clearCurrentUserAssets = () => {
  const assetsKey = getAssetsKey();
  if (assetsKey) {
    localStorage.removeItem(assetsKey);
  }
};
