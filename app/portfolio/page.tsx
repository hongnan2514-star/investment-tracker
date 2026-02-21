"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Zap, Home, BarChart3, X, ChevronRight, Search,
  Loader2, AlertCircle, ArrowLeft, TrendingUp, BarChart2,
  PieChart, Bitcoin, Activity, Car, Coins, Blocks
} from 'lucide-react';
import { AShareNameMap } from '@/src/constants/shareNames';
import { CAR_BRANDS, CarBrand } from '@/src/constants/carBrands';
import { Asset } from '@/src/constants/types';
import { addAsset, getAssets, removeAsset } from '@/src/utils/assetStorage';
import { refreshAllAssets } from '@/src/services/marketService';
import { eventBus } from '@/src/utils/eventBus';
import { cacheLogo, getCachedLogo, removeCachedLogo } from '@/src/utils/logoCache';

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
type AssetType = 'stock' | 'etf' | 'fund' | 'real_estate' | 'custom' | 'crypto' | 'car' | 'metal' | null;

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

  // 汽车品牌列表（来自聚合数据）
  const [brandsList, setBrandsList] = useState<any[]>([]); // { id, name, logoUrl }
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const [selectedBrandName, setSelectedBrandName] = useState<string>('');
  const [loadingCarData, setLoadingCarData] = useState(false);

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
    removeCachedLogo(symbol);
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

  const handleMainCategoryClick = (category: MainCategory) => {
    setSelectedMainCategory(category);
    setView('subCategories');
  };

  const handleAssetTypeClick = (type: AssetType) => {
    setSelectedAssetType(type);
    setView('search');
    setSearchQuery('');
    setFoundAsset(null);
    setSearchError(null);
    setHoldings("");
    setPurchaseDate("");
    setCostPrice("");

    // 重置汽车相关状态
    setBrandsList([]);
    setSelectedBrandId('');
    setSelectedBrandName('');
    // 如果是汽车类型，加载品牌列表
    if (type === 'car') {
      loadBrands();
    }
  };

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

  // 加载汽车品牌列表
  const loadBrands = async () => {
    setLoadingCarData(true);
    try {
      const res = await fetch('/api/car/brands');
      const result = await res.json();
      if (result.success) {
        setBrandsList(result.data || []);
      } else {
        console.error('加载品牌失败:', result.error);
      }
    } catch (error) {
      console.error('加载品牌异常:', error);
    } finally {
      setLoadingCarData(false);
    }
  };

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

      if (selectedAssetType === 'stock' && /^\d{6}$/.test(trimmedQuery)) {
        finalSymbol = normalizeAStockSymbol(trimmedQuery);
      }

      const response = await fetch(`/api/search?symbol=${encodeURIComponent(finalSymbol)}&type=${selectedAssetType || ''}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `搜索失败(${response.status})`);
      }

      if (!data || !data.symbol) {
        throw new Error('返回的数据格式不正确');
      }

      const chineseName = AShareNameMap[data.symbol] || data.name;
      let logoUrl = '';

      if (data.type === 'stock' || data.type === 'etf') {
        const cleanSymbol = data.symbol.replace(/\.(SS|SZ|US|OF)$/, '');
        if (cleanSymbol && process.env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID) {
          logoUrl = `https://cdn.brandfetch.io/ticker/${cleanSymbol}?c=${process.env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID}`;
        }
      } else if (data.type === 'crypto') {
        const cleanSymbol = data.symbol.split('/')[0].trim();
        if (cleanSymbol && process.env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID) {
          logoUrl = `https://cdn.brandfetch.io/crypto/${cleanSymbol}?c=${process.env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID}`;
        }
      }

      setFoundAsset({
        symbol: data.symbol,
        name: chineseName,
        price: data.price,
        changePercent: data.changePercent || 0,
        market: data.market || 'Unknown',
        currency: data.currency || 'USD',
        type: data.type || selectedAssetType || 'stock',
        source: data.source || 'Unknown',
        logoUrl: logoUrl,
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
        // 重置汽车状态
        setBrandsList([]);
        setSelectedBrandId('');
        setSelectedBrandName('');
      }
      touchStartY.current = null;
    }
  };

  useEffect(() => {
    setAssets(getAssets());
  }, []);

  // 汽车添加处理（纯手动输入）
  const handleAddCarAsset = () => {
    if (!selectedBrandId) {
      alert('请选择品牌');
      return;
    }
    // 获取手动输入的车系和车型
    const seriesInput = (document.getElementById('car-series') as HTMLInputElement)?.value || '';
    const modelInput = (document.getElementById('car-model') as HTMLInputElement)?.value || '';
    if (!seriesInput.trim() || !modelInput.trim()) {
      alert('请完整填写车系和车型');
      return;
    }
    if (!holdings) {
      alert('请填写持有数量');
      return;
    }

    const holdingsNum = parseFloat(holdings);
    const price = costPrice ? parseFloat(costPrice) : 0;
    const finalMarketValue = price * holdingsNum;

    // 组合车名：品牌名 + 车系 + 车型
    const carName = `${selectedBrandName} ${seriesInput} ${modelInput}`.trim();
    // 从 brandsList 获取品牌 Logo
    const brand = brandsList.find(b => b.id === selectedBrandId);
    const logoUrl = brand?.logoUrl;

    const newAsset: Asset = {
      symbol: `CAR-${selectedBrandId}-${Date.now()}`,
      name: carName,
      price: price,
      holdings: holdingsNum,
      marketValue: finalMarketValue,
      currency: 'CNY',
      lastUpdated: new Date().toISOString(),
      type: 'car',
      changePercent: 0,
      logoUrl: logoUrl,
      purchaseDate: purchaseDate || undefined,
      costPrice: price,
    };

    addAsset(newAsset);
    setAssets(getAssets());

    alert(`已添加汽车资产: ${carName}`);

    // 重置状态并关闭菜单
    setSelectedBrandId('');
    setSelectedBrandName('');
    setHoldings("");
    setPurchaseDate("");
    setCostPrice("");
    setView('categories');
    setSelectedMainCategory(null);
    setSelectedAssetType(null);
    setShowMenu(false);
  };

  const handleAddAsset = () => {
    if (!foundAsset || !holdings) return;

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

    if (foundAsset.logoUrl) {
      cacheLogo(foundAsset.symbol, foundAsset.logoUrl).catch(console.warn);
    }

    alert(`已添加 ${foundAsset.name} (${foundAsset.symbol}) 到资产列表`);

    setFoundAsset(null);
    setSearchQuery('');
    setHoldings("");
    setPurchaseDate("");
    setCostPrice("");
    setView('categories');
    setSelectedMainCategory(null);
    setSelectedAssetType(null);
    setShowMenu(false);
  };

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
            <button
              onClick={() => handleAssetTypeClick('stock')}
              className="flex items-center justify-between p-5 bg-blue-50 dark:bg-blue-900/30 rounded-[28px] border border-blue-100 dark:border-blue-800 group active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/20">
                  <TrendingUp size={24} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-blue-900 dark:text-blue-300 text-lg">股票</p>
                  <p className="text-xs text-blue-600/70 dark:text-blue-400/70 font-medium">美股、A股、港股</p>
                </div>
              </div>
              <ChevronRight className="text-blue-300 dark:text-blue-500 group-active:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => handleAssetTypeClick('etf')}
              className="flex items-center justify-between p-5 bg-blue-50 dark:bg-blue-900/30 rounded-[28px] border border-blue-100 dark:border-blue-800 group active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/20">
                  <BarChart2 size={24} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-blue-900 dark:text-blue-300 text-lg">ETF</p>
                  <p className="text-xs text-blue-600/70 dark:text-blue-400/70 font-medium">交易所交易基金</p>
                </div>
              </div>
              <ChevronRight className="text-blue-300 dark:text-blue-500 group-active:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => handleAssetTypeClick('fund')}
              className="flex items-center justify-between p-5 bg-blue-50 dark:bg-blue-900/30 rounded-[28px] border border-blue-100 dark:border-blue-800 group active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/20">
                  <PieChart size={24} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-blue-900 dark:text-blue-300 text-lg">基金</p>
                  <p className="text-xs text-blue-600/70 dark:text-blue-400/70 font-medium">场外基金、指数基金</p>
                </div>
              </div>
              <ChevronRight className="text-blue-300 dark:text-blue-500 group-active:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => handleAssetTypeClick('crypto')}
              className="flex items-center justify-between p-5 bg-blue-50 dark:bg-blue-900/30 rounded-[28px] border border-blue-100 dark:border-blue-800 group active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/20">
                  <Bitcoin size={24} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-blue-900 dark:text-blue-300 text-lg">加密货币</p>
                  <p className="text-xs text-blue-600/70 dark:text-blue-400/70 font-medium">BTC、ETH、主流币</p>
                </div>
              </div>
              <ChevronRight className="text-blue-300 dark:text-blue-500 group-active:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => handleAssetTypeClick('metal')}
              className="flex items-center justify-between p-5 bg-blue-50 dark:bg-blue-900/30 rounded-[28px] border border-blue-100 dark:border-blue-800 group active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/20">
                  <Blocks size={24} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-blue-900 dark:text-blue-300 text-lg">贵金属</p>
                  <p className="text-xs text-blue-600/70 dark:text-blue-400/70 font-medium">黄金、白银 (Au999, XAU)</p>
                </div>
              </div>
              <ChevronRight className="text-blue-300 dark:text-blue-500 group-active:translate-x-1 transition-transform" />
            </button>
          </>
        )}
        {selectedMainCategory === 'fixed' && (
          <>
            <button
              onClick={() => handleAssetTypeClick('real_estate')}
              className="flex items-center justify-between p-5 bg-blue-50 dark:bg-blue-900/30 rounded-[28px] border border-blue-100 dark:border-blue-800 group active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="bg-yellow-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/20">
                  <Home size={24} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-blue-900 dark:text-blue-300 text-lg">房产</p>
                  <p className="text-xs text-blue-600/70 dark:text-blue-400/70 font-medium">住宅、商铺</p>
                </div>
              </div>
              <ChevronRight className="text-blue-300 dark:text-blue-500 group-active:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => handleAssetTypeClick('car')}
              className="flex items-center justify-between p-5 bg-blue-50 dark:bg-blue-900/30 rounded-[28px] border border-blue-100 dark:border-blue-800 group active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="bg-yellow-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/20">
                  <Car size={24} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-blue-900 dark:text-blue-300 text-lg">汽车</p>
                  <p className="text-xs text-blue-600/70 dark:text-blue-400/70 font-medium">品牌选择 + 手动输入</p>
                </div>
              </div>
              <ChevronRight className="text-blue-300 dark:text-blue-500 group-active:translate-x-1 transition-transform" />
            </button>
          </>
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
                <p className="font-bold text-blue-900 dark:text-blue-300 text-lg">自定义资产</p>
                <p className="text-xs text-blue-600/70 dark:text-blue-400/70 font-medium">收藏品、储蓄卡、奢侈品</p>
              </div>
            </div>
            <ChevronRight className="text-blue-300 dark:text-blue-500 group-active:translate-x-1 transition-transform" />
          </button>
        )}
      </div>
    </div>
  );

  // 汽车手动添加表单（品牌选择 + 手动输入车系/车型）
  const renderCarForm = () => (
    <div className="bg-white dark:bg-[#0a0a0a] border-2 border-blue-500 p-6 rounded-[32px] shadow-xl shadow-blue-50 dark:shadow-blue-900/20 animate-in zoom-in-95 duration-300">
      <div className="flex flex-col gap-2 mb-6">
        <div className="flex items-center gap-2">
          <span className="bg-yellow-600 text-[10px] text-white px-2 py-0.5 rounded-md font-bold uppercase">
            汽车
          </span>
        </div>

        {loadingCarData && (
          <div className="flex justify-center py-4">
            <Loader2 className="animate-spin text-blue-600 dark:text-blue-400" size={24} />
          </div>
        )}

        <div className="space-y-4">
          {/* 品牌选择 */}
          <div>
            <label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">品牌</label>
            <select
              className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-blue-500"
              value={selectedBrandId}
              onChange={(e) => {
                const brandId = e.target.value;
                const brand = brandsList.find(b => b.id === brandId);
                setSelectedBrandId(brandId);
                setSelectedBrandName(brand?.name || '');
              }}
            >
              <option value="">选择品牌</option>
              {brandsList.map(brand => (
                <option key={brand.id} value={brand.id}>{brand.name}</option>
              ))}
            </select>
          </div>

          {/* 手动输入车系 */}
          <div>
            <label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">车系</label>
            <input
              id="car-series"
              type="text"
              placeholder="例如 A4L, 3系, Model Y"
              className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-blue-500"
            />
          </div>

          {/* 手动输入车型 */}
          <div>
            <label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">车型</label>
            <input
              id="car-model"
              type="text"
              placeholder="例如 2023款 45 TFSI, 330i, 标准续航版"
              className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-blue-500"
            />
          </div>

          {/* Logo预览（直接从 brandsList 获取） */}
          {selectedBrandId && (
            <div className="flex items-center gap-3 mt-2 p-3 bg-gray-50 dark:bg-[#1a1a1a] rounded-2xl">
              {(() => {
                const brand = brandsList.find(b => b.id === selectedBrandId);
                return brand?.logoUrl ? (
                  <img src={brand.logoUrl} alt={selectedBrandName} className="w-10 h-10 object-contain" />
                ) : (
                  <Car size={24} className="text-gray-500" />
                );
              })()}
              <span className="font-bold text-gray-900 dark:text-gray-100">{selectedBrandName}</span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
        <div>
          <label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">持有数量</label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              placeholder="1"
              className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-blue-500"
              value={holdings}
              onChange={(e) => setHoldings(e.target.value)}
              step="1"
              min="0"
            />
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
          <label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">买入价（万元）</label>
          <input
            type="number"
            placeholder="20.00"
            className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-blue-500"
            value={costPrice}
            onChange={(e) => setCostPrice(e.target.value)}
            step="0.01"
          />
          <p className="text-xs text-gray-400 mt-1">单位：万元（CNY）</p>
        </div>

        <button
          onClick={handleAddCarAsset}
          disabled={!selectedBrandId || !holdings}
          className="w-full bg-blue-600 text-white font-black py-4 rounded-[20px] shadow-lg shadow-blue-200 dark:shadow-blue-900/20 active:scale-[0.98] transition-all disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
        >
          确认添加汽车
        </button>
      </div>
    </div>
  );

  const renderSearch = () => {
    if (selectedAssetType === 'car') {
      return (
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
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">添加汽车资产</h3>
          </div>
          <div className="min-h-[200px]">{renderCarForm()}</div>
        </div>
      );
    }

    return (
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
            搜索
            {selectedAssetType === 'stock' && '股票'}
            {selectedAssetType === 'etf' && 'ETF'}
            {selectedAssetType === 'fund' && '基金'}
            {selectedAssetType === 'crypto' && '加密货币'}
            {selectedAssetType === 'real_estate' && '房产'}
            {selectedAssetType === 'metal' && '贵金属'}
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
            {selectedAssetType === 'real_estate' && '房产项目名称 (如: 学府家苑、麓湖生态城)'}
            {selectedAssetType === 'metal' && '贵金属代码 (Au999, Ag999, XAU, XAG)'}
          </p>
        </div>

        <div className="min-h-[200px]">
          {isLoading ? (
            <div className="flex flex-col items-center py-10 gap-3">
              <Loader2 className="animate-spin text-blue-600 dark:text-blue-400" size={32} />
              <p className="text-sm font-bold text-gray-400 dark:text-gray-500">正在调取行情...</p>
            </div>
          ) : searchError ? (
            <div className="text-center py-10">
              <AlertCircle className="w-12 h-12 text-red-400 dark:text-red-500 mx-auto mb-3" />
              <p className="text-red-500 dark:text-red-400 font-bold italic">{searchError}</p>
            </div>
          ) : foundAsset ? (
            <div className="bg-white dark:bg-[#0a0a0a] border-2 border-blue-500 p-6 rounded-[32px] shadow-xl shadow-blue-50 dark:shadow-blue-900/20 animate-in zoom-in-95 duration-300">
              <div className="flex flex-col gap-2 mb-6">
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
                <div className="flex justify-between items-center">
                  <h4 className="text-3xl font-black text-gray-900 dark:text-gray-100">{foundAsset.name}</h4>
                  <div className="text-right">
                    <p className="text-2xl font-black text-gray-900 dark:text-gray-100 flex justify-end items-center gap-1">
                      {currencySymbolMap[foundAsset.currency] || foundAsset.currency}
                      <span>{(foundAsset.price ?? 0).toFixed(2)}</span>
                    </p>
                    {foundAsset.type === 'real_estate' && (foundAsset.changePercent ?? 0) === 0 ? (
                      <p className="text-xs font-bold text-gray-400">暂无涨跌</p>
                    ) : (
                      <p className={`text-xs font-bold ${(foundAsset.changePercent ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {(foundAsset.changePercent ?? 0) >= 0 ? '+' : ''}
                        {(foundAsset.changePercent ?? 0).toFixed(2)}%
                      </p>
                    )}
                  </div>
                </div>
                <p className="text-sm font-bold text-gray-400 dark:text-gray-500">{foundAsset.symbol}</p>
              </div>

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
              <p className="text-gray-300 dark:text-gray-600 font-bold italic">未找到该代码，请确保输入正确</p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">尝试输入其他代码</p>
            </div>
          ) : null}
        </div>
      </div>
    );
  };

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

            const cachedLogo = getCachedLogo(asset.symbol);
            const logoSrc = cachedLogo || asset.logoUrl;

            return (
              <div
                key={asset.symbol}
                className="bg-white dark:bg-[#0a0a0a] p-3 rounded-[20px] shadow-sm shadow-blue-200 dark:shadow-black/50 overflow-hidden hover:shadow-md transition-all"
              >
                <div className="flex justify-between items-start gap-1.5">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="flex-shrink-0">
                      {logoSrc ? (
                        <img
                          src={logoSrc}
                          alt={asset.name}
                          className="w-6 h-6 object-contain rounded-lg"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <>
                          {asset.type === 'car' && <Car size={16} className="text-gray-700 dark:text-gray-200" />}
                          {asset.type === 'stock' && <Zap size={16} className="text-gray-700 dark:text-gray-200" />}
                          {asset.type === 'metal' && (
  asset.symbol && asset.symbol.includes('Ag') ? (
    // 白银图标（可自定义图片或改用其他Lucide图标）
    < img src="/icons/silver-bar.png" alt="Silver" className="w-4 h-4 object-contain" />
  ) : (
    // 黄金图标（可自定义图片或保留Coins）
    < img src="/icons/gold-bar.png" alt="Gold" className="w-4 h-4 object-contain" />
  )
)}
                          {!['car', 'stock', 'metal'].includes(asset.type) && <BarChart3 size={16} className="text-gray-700 dark:text-gray-200" />}
                        </>
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
                    <p className="text-xs text-blue-600/70 dark:text-blue-400/70 font-medium">股票、基金、ETF、加密货币、贵金属</p>
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
          setBrandsList([]);
          setSelectedBrandId('');
          setSelectedBrandName('');
        }}
        className="fixed bottom-24 right-6 w-16 h-16 bg-blue-600 rounded-full shadow-2xl shadow-blue-200 dark:shadow-blue-900/30 flex items-center justify-center text-white z-[45] active:scale-90 transition-transform"
      >
        <Plus size={36} strokeWidth={3} />
      </button>
    </main>
  );
}