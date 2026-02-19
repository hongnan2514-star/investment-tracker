"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Plus, Zap, Home, BarChart3, X, ChevronRight, Search, Loader2, AlertCircle, ArrowLeft, TrendingUp, BarChart2, PieChart, Bitcoin, Activity } from 'lucide-react';
import { AShareNameMap } from '@/src/constants/shareNames';
import { LOCAL_LOGO_MAP, getBaseSymbol } from '@/src/constants/localLogos';
import { Asset } from '@/src/constants/types';
import { addAsset, getAssets, removeAsset } from '@/src/utils/assetStorage';
import { refreshAllAssets } from '@/src/services/marketService';
import { eventBus } from '@/src/utils/eventBus';

interface FoundAsset {
  symbol: string;
  name: string;
  price: number | null;
  changePercent: number | null;
  market: string;
  currency: string;
  type: string;
  source: string;
  logoUrl?: string;
}

type MainCategory = 'liquid' | 'fixed' | 'custom' | null;
type AssetType = 'stock' | 'etf' | 'fund' | 'real_estate' | 'custom' | 'crypto' | null;

export default function PortfolioPage() {
  const [showMenu, setShowMenu] = useState(false);
  const [view, setView] = useState<'categories' | 'subCategories' | 'search'>('categories');
  const [selectedMainCategory, setSelectedMainCategory] = useState<MainCategory>(null);
  const [selectedAssetType, setSelectedAssetType] = useState<AssetType>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [foundAsset, setFoundAsset] = useState<FoundAsset | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [holdings, setHoldings] = useState<string>("");
  const [purchaseDate, setPurchaseDate] = useState<string>("");
  const [costPrice, setCostPrice] = useState<string>("");
  const [marketValue, setMarketValue] = useState<number | null>(null);

  // 滑动关闭相关
  const touchStartY = useRef<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = eventBus.subscribe('userChanged', () => {
      setAssets(getAssets());
    });
    return () => unsubscribe();
  }, []);

  const [assets, setAssets] = useState<Asset[]>([]);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshTimer = useRef<NodeJS.Timeout | number | null>(null);

  const refreshPrices = async () => {
    const currentAssets = getAssets();
    if (currentAssets.length === 0) {
      setAssets([]);
      return;
    }
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const updatedAssets = await refreshAllAssets(currentAssets);
      setAssets(updatedAssets);
    } catch (error) {
      console.error('刷新价格失败:', error);
    } finally {
      setIsRefreshing(false);
    }
    console.log('当前资产列表:', getAssets().map(a => a.symbol));
  };

  useEffect(() => {
    refreshPrices();
    refreshTimer.current = setInterval(refreshPrices, 10000);
    return () => {
      if (refreshTimer.current) {
        clearInterval(refreshTimer.current as number);
      }
    };
  }, []);

  useEffect(() => {
    refreshPrices();
  }, [assets.length]);

  const currencySymbolMap: Record<string, string> = {
    CNY: '¥',
    USD: '$',
  };

  const abortControllerRef = useRef<AbortController | null>(null);

  const handleDeleteAsset = async (symbol: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    removeAsset(symbol);
    const remainingAssets = getAssets();
    setAssets(remainingAssets);
    if (refreshTimer.current) {
      clearInterval(refreshTimer.current as number);
    }
    refreshTimer.current = setInterval(refreshPrices, 10000);
    console.log(`已删除 ${symbol}，剩余资产:`, remainingAssets.length);
  };

  const formatLargeNumber = (num: number): string => {
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(2) + 'K';
    return num.toFixed(2);
  };

  const normalizeAStockSymbol = (symbol: string) => {
    const trimmed = symbol.trim();
    if (/^[0-9]{6}$/.test(trimmed)) {
      if (trimmed.startsWith('6') || trimmed.startsWith('5')) {
        return `${trimmed}.SS`;
      } else if (trimmed.startsWith('0') || trimmed.startsWith('3') || trimmed.startsWith('1')) {
        return `${trimmed}.SZ`;
      }
    }
    return trimmed;
  };

  useEffect(() => {
    if (foundAsset?.price && holdings) {
      const holdingsNum = parseFloat(holdings);
      if (!isNaN(holdingsNum)) {
        setMarketValue(holdingsNum * (foundAsset.price ?? 0));
      } else {
        setMarketValue(null);
      }
    } else {
      setMarketValue(null);
    }
  }, [holdings, foundAsset?.price]);

  // 处理大类点击
  const handleMainCategoryClick = (category: MainCategory) => {
    setSelectedMainCategory(category);
    setView('subCategories');
  };

  // 处理资产类型点击
  const handleAssetTypeClick = (type: AssetType) => {
    setSelectedAssetType(type);
    setView('search');
    // 重置搜索状态
    setSearchQuery('');
    setFoundAsset(null);
    setSearchError(null);
    setHoldings("");
    setPurchaseDate("");
    setCostPrice("");
  };

  // 返回上一级
  const handleBack = () => {
    if (view === 'subCategories') {
      setView('categories');
      setSelectedMainCategory(null);
    } else if (view === 'search') {
      setView('subCategories');
      setSelectedAssetType(null);
      setFoundAsset(null);
      setSearchQuery('');
      setSearchError(null);
    }
  };

  // 触发搜索
  const triggerSearch = async () => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchError('请输入至少2位代码');
      return;
    }

    setIsLoading(true);
    setFoundAsset(null);
    setSearchError(null);

    try {
      const trimmedQuery = searchQuery.trim();
      let finalSymbol = trimmedQuery;

      // 股票类型时规范化A股代码
      if (selectedAssetType === 'stock' && /^\d{6}$/.test(trimmedQuery)) {
        finalSymbol = normalizeAStockSymbol(trimmedQuery);
      }

      // 请求时带上资产类型参数，方便后端优化
      const response = await fetch(`/api/search?symbol=${encodeURIComponent(finalSymbol)}&type=${selectedAssetType || ''}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `搜索失败(${response.status})`);
      }

      if (!data || !data.symbol) {
        throw new Error('返回的数据格式不正确');
      }

      const chineseName = AShareNameMap[data.symbol] || data.name;
      const baseSymbol = getBaseSymbol(data.symbol);
      const localLogos = LOCAL_LOGO_MAP[baseSymbol] || '';

      setFoundAsset({
        symbol: data.symbol,
        name: chineseName,
        price: data.price,
        changePercent: data.changePercent || 0,
        market: data.market || 'Unknown',
        currency: data.currency || 'USD',
        type: data.type || selectedAssetType || 'stock',
        source: data.source || 'Unknown',
        logoUrl: localLogos,
      });

    } catch (error: any) {
      console.error('Search error:', error);
      if (error.message.includes('404')) {
        setSearchError('未找到该代码对应的资产');
      } else {
        setSearchError(error.message || '搜索失败，请稍后重试');
      }
    } finally {
      setIsLoading(false);
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (searchQuery.length >= 2 && !isSearching) {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => triggerSearch(), 1000);
    }
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [searchQuery, isSearching]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setIsSearching(true);
      triggerSearch();
    }
  };

  // 触摸事件处理
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartY.current) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartY.current;
    if (deltaY > 30) {
      const container = scrollContainerRef.current;
      if (container && container.scrollTop <= 0) {
        setShowMenu(false);
        setView('categories');
        setSelectedMainCategory(null);
        setSelectedAssetType(null);
        setSearchQuery('');
        setFoundAsset(null);
        setSearchError(null);
        setHoldings("");
        setPurchaseDate("");
        setCostPrice("");
      }
      touchStartY.current = null;
    }
  };

  useEffect(() => {
    setAssets(getAssets());
  }, []);

  const handleAddAsset = () => {
    if (foundAsset && holdings) {
      const holdingsNum = parseFloat(holdings);
      const finalMarketValue = marketValue ?? 0;

      const newAsset: Asset = {
        symbol: foundAsset.symbol,
        name: foundAsset.name,
        price: foundAsset.price ?? 0,
        holdings: holdingsNum,
        marketValue: finalMarketValue,
        currency: foundAsset.currency,
        lastUpdated: new Date().toISOString(),
        type: foundAsset.type || selectedAssetType || 'stock',
        changePercent: foundAsset.changePercent || 0,
        logoUrl: foundAsset.logoUrl,
        purchaseDate: purchaseDate || undefined,
        costPrice: costPrice ? parseFloat(costPrice) : undefined,
      };

      addAsset(newAsset);
      setAssets(getAssets());

      alert(`已添加 ${foundAsset.name} (${foundAsset.symbol}) 到资产列表\n持有份额: ${holdingsNum}\n买入日期: ${purchaseDate || '未设置'}\n买入价: ${costPrice ? currencySymbolMap[foundAsset.currency] + parseFloat(costPrice).toFixed(2) : '未设置'}`);

      setFoundAsset(null);
      setSearchQuery('');
      setHoldings("");
      setPurchaseDate("");
      setCostPrice("");
      setView('categories');
      setSelectedMainCategory(null);
      setSelectedAssetType(null);
      setShowMenu(false);
    }
  };

  // 计算盈亏颜色和文本（保持不变）
  const getProfitLossColor = (asset: Asset) => {
    if (asset.costPrice && asset.costPrice > 0) {
      return asset.price > asset.costPrice
        ? 'text-green-600 dark:text-green-400'
        : asset.price < asset.costPrice
        ? 'text-red-600 dark:text-red-400'
        : 'text-gray-900 dark:text-gray-100';
    }
    return asset.changePercent > 0
      ? 'text-green-600 dark:text-green-400'
      : asset.changePercent < 0
      ? 'text-red-600 dark:text-red-400'
      : 'text-gray-900 dark:text-gray-100';
  };

  const getProfitLossSmallColor = (asset: Asset) => {
    if (asset.costPrice && asset.costPrice > 0) {
      return asset.price > asset.costPrice
        ? 'text-green-500 dark:text-green-400'
        : asset.price < asset.costPrice
        ? 'text-red-500 dark:text-red-400'
        : 'text-gray-500 dark:text-gray-400';
    }
    return asset.changePercent > 0
      ? 'text-green-500 dark:text-green-400'
      : asset.changePercent < 0
      ? 'text-red-500 dark:text-red-400'
      : 'text-gray-500 dark:text-gray-400';
  };

  // 子类别视图（资产类型选择）- 图标已优化
const renderSubCategories = () => (
  <div className="flex flex-col animate-in fade-in slide-in-from-right duration-300">
    <div className="flex items-center gap-4 mb-8">
      <button onClick={handleBack} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-500 dark:text-gray-300">
        <ArrowLeft size={20} />
      </button>
      <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
        {selectedMainCategory === 'liquid' ? '流动资产' : selectedMainCategory === 'fixed' ? '固定资产' : '自定义资产'}
      </h3>
    </div>
    <div className="flex flex-col gap-4">
      {selectedMainCategory === 'liquid' && (
        <>
          {/* 股票 */}
          <button
            onClick={() => handleAssetTypeClick('stock')}
            className="flex items-center justify-between p-5 bg-blue-50 dark:bg-blue-900/30 rounded-[28px] border border-blue-100 dark:border-blue-800 group active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/20">
                <TrendingUp size={24} />
              </div>
              <div className="text-left">
                <p className="font-bold text-blue-900 dark:text-blue-300 text-lg">股票</p >
                <p className="text-xs text-blue-600/70 dark:text-blue-400/70 font-medium">美股、A股、港股</p >
              </div>
            </div>
            <ChevronRight className="text-blue-300 dark:text-blue-500 group-active:translate-x-1 transition-transform" />
          </button>

          {/* ETF */}
          <button
            onClick={() => handleAssetTypeClick('etf')}
            className="flex items-center justify-between p-5 bg-blue-50 dark:bg-blue-900/30 rounded-[28px] border border-blue-100 dark:border-blue-800 group active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/20">
                <BarChart2 size={24} />
              </div>
              <div className="text-left">
                <p className="font-bold text-blue-900 dark:text-blue-300 text-lg">ETF</p >
                <p className="text-xs text-blue-600/70 dark:text-blue-400/70 font-medium">交易所交易基金</p >
              </div>
            </div>
            <ChevronRight className="text-blue-300 dark:text-blue-500 group-active:translate-x-1 transition-transform" />
          </button>

          {/* 基金 */}
          <button
            onClick={() => handleAssetTypeClick('fund')}
            className="flex items-center justify-between p-5 bg-blue-50 dark:bg-blue-900/30 rounded-[28px] border border-blue-100 dark:border-blue-800 group active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/20">
                <PieChart size={24} />
              </div>
              <div className="text-left">
                <p className="font-bold text-blue-900 dark:text-blue-300 text-lg">基金</p >
                <p className="text-xs text-blue-600/70 dark:text-blue-400/70 font-medium">场外基金、指数基金</p >
              </div>
            </div>
            <ChevronRight className="text-blue-300 dark:text-blue-500 group-active:translate-x-1 transition-transform" />
          </button>

          {/* 加密货币 */}
          <button
            onClick={() => handleAssetTypeClick('crypto')}
            className="flex items-center justify-between p-5 bg-blue-50 dark:bg-blue-900/30 rounded-[28px] border border-blue-100 dark:border-blue-800 group active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/20">
                <Bitcoin size={24} />
              </div>
              <div className="text-left">
                <p className="font-bold text-blue-900 dark:text-blue-300 text-lg">加密货币</p >
                <p className="text-xs text-blue-600/70 dark:text-blue-400/70 font-medium">BTC、ETH、主流币</p >
              </div>
            </div>
            <ChevronRight className="text-blue-300 dark:text-blue-500 group-active:translate-x-1 transition-transform" />
          </button>
        </>
      )}
      {selectedMainCategory === 'fixed' && (
        <button
          onClick={() => handleAssetTypeClick('real_estate')}
          className="flex items-center justify-between p-5 bg-blue-50 dark:bg-blue-900/30 rounded-[28px] border border-blue-100 dark:border-blue-800 group active:scale-[0.98] transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="bg-yellow-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/20">
              <Home size={24} />
            </div>
            <div className="text-left">
              <p className="font-bold text-blue-900 dark:text-blue-300 text-lg">房产</p >
              <p className="text-xs text-blue-600/70 dark:text-blue-400/70 font-medium">住宅、商铺</p >
            </div>
          </div>
          <ChevronRight className="text-blue-300 dark:text-blue-500 group-active:translate-x-1 transition-transform" />
        </button>
      )}
      {selectedMainCategory === 'custom' && (
        <button
          onClick={() => handleAssetTypeClick('custom')}
          className="flex items-center justify-between p-5 bg-blue-50 dark:bg-blue-900/30 rounded-[28px] border border-blue-100 dark:border-blue-800 group active:scale-[0.98] transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="bg-green-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/20">
              <Activity size={24} />
            </div>
            <div className="text-left">
              <p className="font-bold text-blue-900 dark:text-blue-300 text-lg">自定义资产</p >
              <p className="text-xs text-blue-600/70 dark:text-blue-400/70 font-medium">收藏品、储蓄卡、奢侈品</p >
            </div>
          </div>
          <ChevronRight className="text-blue-300 dark:text-blue-500 group-active:translate-x-1 transition-transform" />
        </button>
      )}
    </div>
  </div>
);

  // 搜索视图
  const renderSearch = () => (
  <div
    ref={scrollContainerRef}
    onTouchStart={handleTouchStart}
    onTouchMove={handleTouchMove}
    className="flex flex-col animate-in fade-in slide-in-from-right duration-300 max-h-[70vh] overflow-y-auto"
  >
    <div className="flex items-center gap-4 mb-8">
      <button onClick={handleBack} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-500 dark:text-gray-300">
        <ArrowLeft size={20} />
      </button>
      <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
        搜索{selectedAssetType === 'stock' ? '股票' : selectedAssetType === 'etf' ? 'ETF' : selectedAssetType === 'fund' ? '基金' : '加密货币'}
      </h3>
    </div>

    <div className="relative mb-8">
      <Search className="absolute left-5 top-6 text-gray-400 dark:text-gray-500" size={20} />
      <input
        autoFocus
        type="text"
        placeholder="输入代码"
        className="w-full bg-gray-50 dark:bg-[#1a1a1a] border-2 border-gray-100 dark:border-gray-800 p-5 pl-14 rounded-[24px] outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-[#2a2a2a] transition-all font-bold text-gray-900 dark:text-gray-100 text-lg placeholder:text-gray-300 dark:placeholder:text-gray-500"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        ref={inputRef}
      />
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 ml-1">
        {selectedAssetType === 'stock' && '支持美股 (AAPL)、A股 (600519)'}
        {selectedAssetType === 'etf' && '支持ETF (VOO, SPY)'}
        {selectedAssetType === 'fund' && '基金代码 (如 017174)'}
        {selectedAssetType === 'crypto' && '加密货币 (BTC, ETH, SOL)'}
      </p >
    </div>

    <div className="min-h-[200px]">
      {isLoading ? (
        <div className="flex flex-col items-center py-10 gap-3">
          <Loader2 className="animate-spin text-blue-600 dark:text-blue-400" size={32} />
          <p className="text-sm font-bold text-gray-400 dark:text-gray-500">正在调取行情...</p >
        </div>
      ) : searchError ? (
        <div className="text-center py-10">
          <AlertCircle className="w-12 h-12 text-red-400 dark:text-red-500 mx-auto mb-3" />
          <p className="text-red-500 dark:text-red-400 font-bold italic">{searchError}</p >
        </div>
      ) : foundAsset ? (
        <div className="bg-white dark:bg-[#0a0a0a] border-2 border-blue-500 p-6 rounded-[32px] shadow-xl shadow-blue-50 dark:shadow-blue-900/20 animate-in zoom-in-95 duration-300">
          {/* 重新组织布局：市场标签在上，名称与价格同行，代码符号在下 */}
          <div className="flex flex-col gap-2 mb-6">
            {/* 市场标签行 */}
            <div className="flex items-center gap-2">
              <span className="bg-blue-600 text-[10px] text-white px-2 py-0.5 rounded-md font-bold uppercase">
                {foundAsset.market}
              </span>
              {foundAsset.type && (
                <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">
                  {foundAsset.type.toUpperCase()}
                </span>
              )}
            </div>
            {/* 名称和价格行（现在在同一行） */}
            <div className="flex justify-between items-center">
              <h4 className="text-3xl font-black text-gray-900 dark:text-gray-100">{foundAsset.name}</h4>
              <div className="text-right t-6">
                <p className="text-2xl font-black text-gray-900 dark:text-gray-100 flex justify-end items-center gap-1">
                  {currencySymbolMap[foundAsset.currency] || foundAsset.currency}
                  <span>{(foundAsset.price ?? 0).toFixed(2)}</span>
                </p >
                <p className={`text-xs font-bold ${(foundAsset.changePercent ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {(foundAsset.changePercent ?? 0) >= 0 ? '+' : ''}
                  {(foundAsset.changePercent ?? 0).toFixed(2)}%
                </p >
              </div>
            </div>
            {/* 代码符号 */}
            <p className="text-sm font-bold text-gray-400 dark:text-gray-500">{foundAsset.symbol}</p >
          </div>

          {/* 以下表单部分保持不变 */}
          <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            <div>
              <label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">持有份额</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  placeholder="0.00"
                  className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-blue-500"
                  value={holdings}
                  onChange={(e) => setHoldings(e.target.value)}
                  step="0.01"
                />
                {marketValue !== null && (
                  <div className="font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                    {currencySymbolMap[foundAsset.currency]}{marketValue.toFixed(2)}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">买入日期</label>
              <input
                type="date"
                className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-blue-500 appearance-none"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
            </div>

            <div>
              <label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">买入价</label>
              <input
                type="number"
                placeholder="0.00"
                className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-blue-500"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                step="0.01"
              />
            </div>

            <button
              onClick={handleAddAsset}
              disabled={!holdings}
              className="w-full bg-blue-600 text-white font-black py-4 rounded-[20px] shadow-lg shadow-blue-200 dark:shadow-blue-900/20 active:scale-[0.98] transition-all disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              确认添加
            </button>
          </div>
        </div>
      ) : searchQuery.length >= 2 ? (
        <div className="text-center py-10">
          <p className="text-gray-300 dark:text-gray-600 font-bold italic">未找到该代码，请确保输入正确</p >
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">尝试输入其他代码</p >
        </div>
      ) : null}
    </div>
  </div>
);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-black p-4 relative">
      <header className="mb-6 px-2">
        <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">资产管理</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">管理并添加您的各类投资项目</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 180px)' }}>
        {assets.length > 0 ? (
          assets.map(asset => {
            const profitLossColor = getProfitLossColor(asset);
            const profitLossSmallColor = getProfitLossSmallColor(asset);
            let displayPercent = asset.changePercent;
            let displayPercentSign = displayPercent > 0 ? '+' : '';
            if (asset.costPrice && asset.costPrice > 0) {
              const calculatedPercent = ((asset.price - asset.costPrice) / asset.costPrice) * 100;
              displayPercent = calculatedPercent;
              displayPercentSign = calculatedPercent > 0 ? '+' : '';
            }
            return (
              <div
                key={asset.symbol}
                className="bg-white dark:bg-[#0a0a0a] p-3 rounded-[20px] shadow-sm shadow-blue-200 dark:shadow-black/50 overflow-hidden hover:shadow-md transition-all"
              >
                <div className="flex justify-between items-start gap-1.5">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="p-1.5 rounded-xl shadow-sm shadow-blue-200 dark:shadow-black/30 bg-white dark:bg-[#1a1a1a] flex-shrink-0">
                      {asset.logoUrl ? (
                        <img src={asset.logoUrl} alt={asset.name} className="w-6 h-6 object-contain" />
                      ) : (
                        asset.type === 'stock' ? <Zap size={16} className="text-gray-700 dark:text-gray-200" /> : <BarChart3 size={16} className="text-gray-700 dark:text-gray-200" />
                      )}
                    </div>
                    <div className="text-left min-w-0 flex-1">
                      <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 line-clamp-1 break-words" title={asset.name}>
                        {asset.name}
                      </h4>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate" title={asset.symbol}>
                        {asset.symbol}
                      </p>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0 max-w-[90px]">
                    <p className={`text-base font-black truncate ${profitLossColor}`} title={`${currencySymbolMap[asset.currency]}${asset.marketValue.toFixed(2)}`}>
                      {currencySymbolMap[asset.currency]}{formatLargeNumber(asset.marketValue)}
                    </p>
                    {displayPercent !== 0 && (
                      <p className={`text-[9px] font-bold ${profitLossSmallColor}`}>
                        {displayPercentSign}{displayPercent.toFixed(2)}%
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end mt-0.5">
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate" title={`${asset.holdings.toFixed(2)}份`}>
                    {asset.holdings.toFixed(2)}份
                  </p>
                </div>

                <div className="mt-2 border-t border-gray-100 dark:border-gray-800 pt-2 flex justify-between items-center">
                  <div className="flex items-center gap-1 min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 flex-shrink-0">
                      {asset.costPrice ? '市价/成本' : '市价'}
                    </p>
                    {asset.costPrice ? (
                      <p className={`text-xs font-bold truncate ${profitLossColor}`} title={`${currencySymbolMap[asset.currency]}${asset.price.toFixed(2)} / ${currencySymbolMap[asset.currency]}${asset.costPrice.toFixed(2)}`}>
                        {currencySymbolMap[asset.currency]}{asset.price.toFixed(2)} / {currencySymbolMap[asset.currency]}{asset.costPrice.toFixed(2)}
                      </p>
                    ) : (
                      <p className="text-xs font-bold truncate text-gray-900 dark:text-gray-100" title={`${currencySymbolMap[asset.currency]}${asset.price.toFixed(2)}`}>
                        {currencySymbolMap[asset.currency]}{asset.price.toFixed(2)}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteAsset(asset.symbol)}
                    className="text-[10px] font-bold text-red-500 dark:text-red-400 hover:underline flex-shrink-0 ml-1"
                  >
                    删除
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 col-span-full">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-3">目前没有任何资产</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-2 max-w-md">
              点击右下方加号开始追踪您的投资
            </p>
          </div>
        )}
      </div>

      {showMenu && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity" onClick={() => setShowMenu(false)} />
      )}

      <div className={`fixed bottom-0 left-0 right-0 bg-white dark:bg-[#0a0a0a] rounded-t-[40px] z-50 p-8 pb-12 transition-transform duration-500 ease-in-out transform ${showMenu ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-8" />

        {view === 'categories' && (
          <>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">添加资产类别</h3>
            <div className="flex flex-col gap-4">
              <button
                onClick={() => handleMainCategoryClick('liquid')}
                className="flex items-center justify-between p-5 bg-blue-50 dark:bg-blue-900/30 rounded-[28px] border border-blue-100 dark:border-blue-800 group active:scale-[0.98] transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/20">
                    <Zap size={24} />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-blue-900 dark:text-blue-300 text-lg">流动资产</p>
                    <p className="text-xs text-blue-600/70 dark:text-blue-400/70 font-medium">股票、基金、ETF、加密货币</p>
                  </div>
                </div>
                <ChevronRight className="text-blue-300 dark:text-blue-500 group-active:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={() => handleMainCategoryClick('fixed')}
                className="flex items-center justify-between p-5 bg-blue-50 dark:bg-blue-900/30 rounded-[28px] border border-blue-100 dark:border-blue-800 group active:scale-[0.98] transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-yellow-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/20">
                    <Home size={24} />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-blue-900 dark:text-blue-300 text-lg">固定资产</p>
                    <p className="text-xs text-blue-600/70 dark:text-blue-400/70 font-medium">房产、汽车、其他固定资产</p>
                  </div>
                </div>
                <ChevronRight className="text-blue-300 dark:text-blue-500 group-active:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={() => handleMainCategoryClick('custom')}
                className="flex items-center justify-between p-5 bg-blue-50 dark:bg-blue-900/30 rounded-[28px] border border-blue-100 dark:border-blue-800 group active:scale-[0.98] transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-green-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/20">
                    <BarChart3 size={24} />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-blue-900 dark:text-blue-300 text-lg">自定义资产</p>
                    <p className="text-xs text-blue-600/70 dark:text-blue-400/70 font-medium">收藏品、储蓄卡、奢侈品</p>
                  </div>
                </div>
                <ChevronRight className="text-blue-300 dark:text-blue-500 group-active:translate-x-1 transition-transform" />
              </button>
            </div>
          </>
        )}

        {view === 'subCategories' && renderSubCategories()}
        {view === 'search' && renderSearch()}
      </div>

      <button
        onClick={() => {
          setShowMenu(true);
          setView('categories');
          setSelectedMainCategory(null);
          setSelectedAssetType(null);
          setSearchQuery('');
          setFoundAsset(null);
          setSearchError(null);
          setHoldings("");
          setPurchaseDate("");
          setCostPrice("");
        }}
        className="fixed bottom-24 right-6 w-16 h-16 bg-blue-600 rounded-full shadow-2xl shadow-blue-200 dark:shadow-blue-900/30 flex items-center justify-center text-white z-[45] active:scale-90 transition-transform"
      >
        <Plus size={36} strokeWidth={3} />
      </button>
    </main>
  );
}