// app/portfolio/PortfolioPageContent.tsx
"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ListFilterPlus } from 'lucide-react';
import { Asset } from '@/src/constants/types';
import { getCurrentUserId } from '@/src/utils/assetStorage';
import { eventBus } from '@/src/utils/eventBus';
import { useTheme } from '../ThemeProvider';
import AssetCard from '@/components/AssetCard';
import { useCurrency, useCurrencyConverter } from '@/src/services/currency';
import AssetDetailDrawer from './AssetDetailDrawer';
import AssetAddFlow from '@/components/AssetAddFlow';
import SortFilterMenu from '@/components/SortFilterMenu';

// ---------- 缓存机制 ----------
type CacheEntry = {
  assets: Asset[];
  timestamp: number;
};
const assetCache = new Map<string, CacheEntry>();
const CACHE_DURATION = 15 * 60 * 1000; // 15分钟

export default function PortfolioPage() {
  const SORT_BY_KEY = 'portfolio_sortBy';
  const SORT_ORDER_KEY = 'portfolio_sortOrder';
  const HIDDEN_TYPES_KEY = 'portfolio_hiddenTypes';

  const [showSortMenu, setShowSortMenu] = useState(false);
  const [convertingAssets, setConvertingAssets] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [convertedAssets, setConvertedAssets] = useState<Asset[]>([]);
  const [hiddenAssetTypes, setHiddenAssetTypes] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(HIDDEN_TYPES_KEY);
      if (saved) {
        try {
          const arr = JSON.parse(saved);
          return new Set(arr);
        } catch (e) {
          console.warn('解析隐藏类型失败', e);
        }
      }
    }
    return new Set();
  });
  const [sortBy, setSortBy] = useState<'marketValue' | 'changePercent'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(SORT_BY_KEY);
      if (saved === 'marketValue' || saved === 'changePercent') return saved;
    }
    return 'marketValue';
  });
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(SORT_ORDER_KEY);
      if (saved === 'asc' || saved === 'desc') return saved;
    }
    return 'desc';
  });
  const [selectedAssetSymbol, setSelectedAssetSymbol] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [dots, setDots] = useState(1);
  const mountedRef = useRef(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { currency } = useCurrency();
  const { convert } = useCurrencyConverter();

  // 动态省略号动画
  useEffect(() => {
    if (isConverting) {
      intervalRef.current = setInterval(() => {
        setDots(prev => (prev % 4) + 1);
      }, 300);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setDots(0);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isConverting]);
  const dotsText = '.'.repeat(dots);

  // 加载资产
  const loadAssets = useCallback(async () => {
    const userId = getCurrentUserId();
    if (!userId) {
      setAssets([]);
      setLoadingAssets(false);
      return;
    }
    const cached = assetCache.get(userId);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log('[PortfolioPage] 使用缓存资产数据');
      setAssets(cached.assets);
      setLoadingAssets(false);
      return;
    }
    setLoadingAssets(true);
    try {
      const res = await fetch('/api/asset', {
        headers: { 'x-user-id': userId },
      });
      if (!res.ok) throw new Error('加载资产失败');
      const data = await res.json();
      const normalizedData = data.map((asset: any) => ({
        ...asset,
        price: Number(asset.price),
        holdings: Number(asset.holdings),
        marketValue: Number(asset.marketValue),
        costPrice: asset.costPrice ? Number(asset.costPrice) : undefined,
        changePercent: asset.changePercent ? Number(asset.changePercent) : 0,
      }));
      assetCache.set(userId, { assets: normalizedData, timestamp: Date.now() });
      setAssets(normalizedData);
    } catch (err) {
      console.error('加载资产失败', err);
      setAssets([]);
    } finally {
      setLoadingAssets(false);
    }
  }, []);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  // 货币转换
  const convertAll = useCallback(async () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsConverting(true);
    setConvertingAssets(true);
    try {
      if (assets.length === 0) {
        setConvertedAssets([]);
        return;
      }
      const converted = await Promise.all(
        assets.map(async (asset) => {
          const fromCurrency = asset.currency || 'USD';
          try {
            const newMarketValue = await convert(asset.marketValue, fromCurrency as any, currency);
            if (newMarketValue == null || isNaN(newMarketValue) || !isFinite(newMarketValue)) {
              return asset;
            }
            return {
              ...asset,
              marketValue: newMarketValue,
              price: await convert(asset.price, fromCurrency as any, currency).catch(() => asset.price),
              costPrice: asset.costPrice ? await convert(asset.costPrice, fromCurrency as any, currency).catch(() => asset.costPrice) : undefined,
            };
          } catch (e) {
            console.error(`转换失败 ${asset.symbol}:`, e);
            return asset;
          }
        })
      );
      setConvertedAssets(converted);
    } catch (error) {
      console.error('货币转换失败:', error);
    } finally {
      setConvertingAssets(false);
      timeoutRef.current = setTimeout(() => {
        if (mountedRef.current) setIsConverting(false);
        timeoutRef.current = null;
      }, 300);
    }
  }, [currency, convert, assets]);

  useEffect(() => {
    convertAll();
  }, [currency, convertAll]);

  // 监听资产更新事件
useEffect(() => {
  const handleUpdate = (updatedAssets?: Asset[]) => {
    const userId = getCurrentUserId();
    if (updatedAssets) {
      setAssets([...updatedAssets]);
      if (userId) assetCache.set(userId, { assets: updatedAssets, timestamp: Date.now() });
    } else {
      // 资产变更事件：清除缓存，强制重新加载
      if (userId) assetCache.delete(userId);
      loadAssets();
    }
  };
  const unsubscribeAssets = eventBus.subscribe('assetsUpdated', handleUpdate);
  const unsubscribeUser = eventBus.subscribe('userChanged', () => {
    loadAssets();
    convertAll();
  });
  return () => {
    unsubscribeAssets();
    unsubscribeUser();
  };
}, [convertAll, loadAssets]);

  // 计算盈亏率
  const getProfitPercent = (asset: Asset): number => {
    if (asset.costPrice && asset.costPrice > 0) {
      return ((asset.price - asset.costPrice) / asset.costPrice) * 100;
    }
    return 0;
  };

  const allAssetTypes = useMemo(() => {
    const types = new Set<string>();
    assets.forEach(asset => {
      if (asset.type) types.add(asset.type);
    });
    return Array.from(types);
  }, [assets]);

  const filteredAndSortedAssets = useMemo(() => {
    const filtered = convertedAssets.filter(asset => !hiddenAssetTypes.has(asset.type));
    return [...filtered].sort((a, b) => {
      if (sortBy === 'marketValue') {
        return sortOrder === 'asc' ? a.marketValue - b.marketValue : b.marketValue - a.marketValue;
      } else {
        const aProfit = getProfitPercent(a);
        const bProfit = getProfitPercent(b);
        return sortOrder === 'asc' ? aProfit - bProfit : bProfit - aProfit;
      }
    });
  }, [convertedAssets, hiddenAssetTypes, sortBy, sortOrder]);

  // 保存排序/隐藏设置到 localStorage
  useEffect(() => {
    localStorage.setItem(SORT_BY_KEY, sortBy);
  }, [sortBy]);
  useEffect(() => {
    localStorage.setItem(SORT_ORDER_KEY, sortOrder);
  }, [sortOrder]);
  useEffect(() => {
    const arr = Array.from(hiddenAssetTypes);
    localStorage.setItem(HIDDEN_TYPES_KEY, JSON.stringify(arr));
  }, [hiddenAssetTypes]);

  // 打开/关闭详情抽屉
  const openAssetDetail = (symbol: string) => {
    setSelectedAssetSymbol(symbol);
    setIsDetailOpen(true);
  };
  const closeAssetDetail = () => {
    setIsDetailOpen(false);
    setTimeout(() => setSelectedAssetSymbol(null), 300);
  };

  // 渲染骨架屏（单列卡片样式）
  const renderSkeleton = () => (
    Array(5).fill(0).map((_, i) => (
      <div key={i} className="bg-white dark:bg-[#0a0a0a] rounded-2xl border border-gray-100 dark:border-gray-800 p-3 animate-pulse">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12" />
              </div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16 mt-1" />
            </div>
          </div>
          <div className="text-right">
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-16 mb-1" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-10 ml-auto" />
          </div>
        </div>
      </div>
    ))
  );

  return (
    <>
      <main className="min-h-screen bg-white dark:bg-black p-4 relative">
        <header className="flex justify-between items-center mb-6 px-2">
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">资产管理</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">管理并添加您的各类投资项目</p>
          </div>
          <div className="flex items-center gap-2">
            {isConverting && <span className="text-xs text-blue-500 animate-pulse">{dotsText}</span>}
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            >
              <ListFilterPlus className="w-6 h-6 text-gray-600 dark:text-gray-300" />
            </button>
          </div>
        </header>

        {/* 排序菜单 */}
        <SortFilterMenu
          show={showSortMenu}
          onClose={() => setShowSortMenu(false)}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={(by, order) => {
            setSortBy(by);
            setSortOrder(order);
          }}
          hiddenAssetTypes={hiddenAssetTypes}
          allAssetTypes={allAssetTypes}
          onToggleHiddenType={(type) => {
            const newHidden = new Set(hiddenAssetTypes);
            if (newHidden.has(type)) newHidden.delete(type);
            else newHidden.add(type);
            setHiddenAssetTypes(newHidden);
          }}
        />

        {/* 资产卡片列表 */}
        <div className="flex flex-col space-y-3">
          {(loadingAssets || convertingAssets) ? (
            renderSkeleton()
          ) : filteredAndSortedAssets.length > 0 ? (
            filteredAndSortedAssets.map(asset => (
              <AssetCard key={asset.symbol} asset={asset} onClick={openAssetDetail} />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-3">目前没有任何资产</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-2 max-w-md">
                点击右下方加号开始追踪您的投资
              </p>
            </div>
          )}
        </div>
      </main>

      {/* 添加资产流程组件（独立浮层） */}
      <AssetAddFlow onAssetAdded={loadAssets} currencySymbolMap={{ CNY: '¥', USD: '$' }} />

      {/* 资产详情抽屉 */}
      <AssetDetailDrawer
        symbol={selectedAssetSymbol}
        isOpen={isDetailOpen}
        onClose={closeAssetDetail}
      />
    </>
  );
}