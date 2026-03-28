// app/portfolio/PortfolioPageContent.tsx
"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {  // 图标
  Plus, Zap, Home, BarChart3, Hotel, X, ChevronRight, Search,
  Loader2, AlertCircle, ArrowLeft, TrendingUp, BarChart2,
  PieChart, Bitcoin, Activity, CarFront, Blocks, MoreVertical, ChevronDown, ListFilterPlus,
  Banknote, Receipt, ReceiptText, ChevronUp 
} from 'lucide-react';
import { AShareNameMap } from '@/src/constants/shareNames';
import { Asset } from '@/src/constants/types';
import { getCurrentUserId, setCurrentUserId } from '@/src/utils/assetStorage';
import { refreshAllAssets } from '@/src/services/marketService';
import { eventBus } from '@/src/utils/eventBus';
import { cacheLogo, getCachedLogo, removeCachedLogo } from '@/src/utils/logoCache';
import { useTheme } from '../ThemeProvider';
import Link from 'next/link';
import { useCurrency, useCurrencyConverter } from '@/src/services/currency';  // 计价单位
import AssetDetailDrawer from './AssetDetailDrawer';
import BrandSelector from './BrandSelector';
import IconSelector from './IconSelector';
import { useAssetRefresh } from '@/src/hooks/useAssetRefresh';

// ---------- 缓存机制 ----------
// 按用户ID缓存资产数据，有效期15分钟
type CacheEntry = {
  assets: Asset[];
  timestamp: number;
};
const assetCache = new Map<string, CacheEntry>();
const CACHE_DURATION = 15 * 60 * 1000; // 15分钟

interface CarBrand {
  id: string;
  name: string;
  firstLetter: string;
  logoUrl?: string;
}

const ASSET_TYPE_CONFIG: Record<string, { name: string; color: string }> = {
  stock: { name: '股票', color: '#1e67f7' },
  fund: { name: '基金', color: '#10b981' },
  crypto: { name: '加密货币', color: '#ec4899' },
  metal: { name: '贵金属', color: '#f59e0b' },
  car: { name: '车辆', color: '#06b6d4' },
  real_estate: { name: '不动产', color: '#f97316' },
  receivable: { name: '应收款', color: '#9b59b6'},
  custom: { name: '现金', color: '#95a5a6' },
  custom_asset: { name: '自定义', color: '#e4f806ff'},
  liability: { name: '负债', color: '#e74c3c'},
};



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
type AssetType = 'stock' | 'etf' | 'fund' | 'real_estate' | 'custom' | 'crypto' | 'car' | 'metal' | 'receivable' | 'custom_asset' | null;

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
  const { theme } = useTheme();
  const SORT_BY_KEY = 'portfolio_sortBy';
  const SORT_ORDER_KEY = 'portfolio_sortOrder';
  const HIDDEN_TYPES_KEY = 'portfolio_hiddenTypes';
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [sortExpanded, setSortExpanded] = useState(false);
  const [filterExpanded, setFilterExpanded] = useState(false);
  const [isLoadingMetal, setIsLoadingMetal] = useState(false);
  const [metalError, setMetalError] = useState<string | null>(null);
  const [realEstateName, setRealEstateName] = useState('');
  const [realEstateIncludeInChart, setRealEstateIncludeInChart] = useState(true);
  const [realEstateNotes, setRealEstateNotes] = useState('');
  const [showBrandSelector, setShowBrandSelector] = useState(false);
  const [imageFileNames, setImageFileNames] = useState<string[]>([]);
  const [cashName, setCashName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState<string>('');
  const [showIconPage, setShowIconPage] = useState(false);
  const [realEstateQuantity, setRealEstateQuantity] = useState<string>('1');
  const [customAssetType, setCustomAssetType] = useState<string>('');          // 选择的子类型
  const [customAssetName, setCustomAssetName] = useState<string>('');
  const [customAssetAmount, setCustomAssetAmount] = useState<string>('');
  const [customAssetOrderDate, setCustomAssetOrderDate] = useState<string>('');
  const [customAssetNotes, setCustomAssetNotes] = useState<string>('');
  const [customAssetIncludeInChart, setCustomAssetIncludeInChart] = useState<boolean>(true);
  const [convertingAssets, setConvertingAssets] = useState(false);
  
  // 使用前过滤
  const slugify = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[·・•\-_\s]+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5\-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, ''); 
}; 
 
// 使用前过滤，重新生成 id 和 logoUrl
useEffect(() => {
  fetch('/car_logo_filenames.json')
    .then(res => res.json())
    .then(setImageFileNames)
    .catch(err => console.warn('无法加载文件名列表', err));
}, []);

// 修改 carBrands 定义
const carBrands: CarBrand[] = [
  // A
  { id: 'audi', name: 'Audi', firstLetter: 'A', logoUrl: '/images/car_logos/audi.png' },
  { id: 'Aston Martin', name: 'Aston Martin', firstLetter: 'A', logoUrl: '/images/car_logos/Aston Martin.png' },
  { id: 'AITO', name: 'AITO', firstLetter: 'A', logoUrl: '/images/car_logos/AITO.png' },
  { id: 'AC', name: 'AC', firstLetter: 'A', logoUrl: '/images/car_logos/AC.png' },
  { id: 'ABARTH', name: 'ABARTH', firstLetter: 'A', logoUrl: 'images/car_logos/ABARTH.png' },
  { id: 'abt', name: 'ABT', firstLetter: 'A', logoUrl: '/images/car_logos/abt.png' },
  { id: 'ac-schnitzer', name: 'AC Schnitzer', firstLetter: 'A', logoUrl: '/images/car_logos/ac-schnitzer.png' },
  { id: 'Alfa Romeo', name: 'Alfa Romeo', firstLetter:'A', logoUrl: '/images/car_logos/Alfa Romeo.png' },
  { id: 'AION', name: 'AION', firstLetter: 'A', logoUrl: '/images/car_logos/AION.png' },
  { id: 'AEHRA', name: 'AEHRA', firstLetter: 'A', logoUrl: '/images/car_logos/aehra.png' },
  { id: 'AEV robotics', name: 'AEV robotics', firstLetter: 'A', logoUrl: '/images/car_logos/AEV robotics.png' },
  { id: 'AFEELA', name: 'AFEELA', firstLetter: 'A', logoUrl: '/images/car_logos/afeela.png' },
  { id: 'Agile Automotive', name: 'Agile Automotive', firstLetter: 'A', logoUrl: '/images/car_logos/Agile Automotive.png' },
  { id: 'AIM', name: 'AIM', firstLetter: 'A', logoUrl: '/images/car_logos/aim.png' },
  { id: 'Alpha Motor', name: 'Alpha Motor', firstLetter: 'A', logoUrl: '/images/car_logos/Alpha Motor.png' },
  { id: 'Alpina', name: 'Alpina', firstLetter: 'A', logoUrl: 'images/car_logos/alpina.png' },
  { id: 'Alpine', name: 'Alpine', firstLetter: 'A', logoUrl: '/images/car_logos/alpine233.png' },
  { id: 'AM晓澳', name: 'AM晓澳', firstLetter: 'A', logoUrl: '/images/car_logos/am晓澳.png' },
  { id: 'APEX', name: 'APEX', firstLetter: 'A', logoUrl: '/images/car_logos/apex.png' },
  { id: 'apollo', name: 'apollo', firstLetter: 'A', logoUrl: '/images/car_logos/apollo.png' },
  { id: 'ARASH', name: 'ARASH', firstLetter: 'A', logoUrl: '/images/car_logos/arash.png' },
  { id: '阿莫迪罗', name: '阿莫迪罗', firstLetter: 'A', logoUrl: '/images/car_logos/阿莫迪罗.png'},
  { id: '阿娜亚', name: '阿娜亚', firstLetter: 'A', logoUrl: '/images/car_logos/阿娜亚.png'},
  { id: 'AIAT', name: 'AIAT', firstLetter: 'A', logoUrl: '/images/car_logos/aiat.png'},
  { id: 'arcfox极狐', name: 'arcfox极狐', firstLetter: 'A', logoUrl: '/images/car_logos/arcfox极狐.png'},
  { id: '阿维塔', name: '阿维塔', firstLetter: 'A', logoUrl: '/images/car_logos/阿维塔.png'},
  { id: '埃尚', name: '埃尚', firstLetter: 'A', logoUrl: '/images/car_logos/埃尚.png'},
  { id: 'ICONIO', name: 'ICONIO', firstLetter: 'A', logoUrl: '/images/car_logos/ICONIO.png'},

  // B
  { id: 'BMW', name: 'BMW', firstLetter: 'B', logoUrl: '/images/car_logos/BMW.png' },
  { id: 'BUGATTI', name: 'BUGATTI', firstLetter: 'B', logoUrl: '/images/car_logos/布加迪.png'},
  { id: 'Porsche', name: 'Porsche', firstLetter:'P', logoUrl:'/images/car_logos/Porsche.png' },
  { id: 'Bentley', name: 'Bentley', firstLetter:'B', logoUrl:'/images/car_logos/宾利.png' },
  { id: 'Lamborghini', name: 'Lamborghini', firstLetter:' L', logoUrl:'/images/car_logos/Lamborghini.png' },
  { id: 'Rolls Royce', name: 'Rolls Royce', firstLetter:' L', logoUrl:'/images/car_logos/劳斯莱斯.png' },

  // H
  { id: 'HONDA', name: 'HONDA', firstLetter: 'H', logoUrl: '/images/car_logos/HONDA.png'},

  // K
  { id: 'Chrysler', name: 'Chrysler', firstLetter:'K', logoUrl:'/images/car_logos/克莱斯勒.png' },

  // M
  { id: 'mercedes-benz', name: 'Mercedes-Benz', firstLetter: 'M', logoUrl: '/images/car_logos/Mercedes-Benz.png' },
  { id: 'Maybach', name: 'Maybach', firstLetter: 'M', logoUrl: '/images/car_logos/Maybach.png' },
  { id: 'Mclaren', name: ' Mclaren', firstLetter: 'M', logoUrl: '/images/car_logos/Mclaren.png' },
  { id: 'MASERATI', name: 'MASERATI', firstLetter: 'M', logoUrl: '/images/car_logos/MASERATI.png' },
  { id: 'MANSORY', name: 'MANSORY', firstLetter: 'M', logoUrl: '/images/car_logos/MANSORY.png' },
  
  // L
  { id: '理想', name: '理想', firstLetter:'L', logoUrl:'/images/car_logos/理想.png'},
  { id: 'Land Rover', name: 'Land Rover', firstLetter:'L', logoUrl:'/images/car_logos/路虎.png'},

  // X
  { id: '小米', name: '小米', firstLetter:'X', logoUrl:'/images/car_logos/小米.png' },
  { id: '小鹏', name: '小鹏', firstLetter:'X', logoUrl:'/images/car_logos/小鹏.png' },
  
  
];

  const metalOptions = [
  { symbol: 'Au99.99', name: '黄金99.99 / Au99.99', price: null, changePercent: null, currency: 'CNY' },
  { symbol: 'Au99.95', name: '黄金99.95 / Au99.95', price: null, changePercent: null, currency: 'CNY' },
  { symbol: 'Au100g', name: '黄金100g / Au100g', price: null, changePercent: null, currency: 'CNY' },
  { symbol: 'AuT+D', name: '黄金 T+D / Au(T+D)', price: null, changePercent: null, currency: 'CNY' },
  { symbol: 'AuT+N1', name: '黄金 T+N1 / Au(T+N1)', price: null, changePercent: null, currency: 'CNY' },
  { symbol: 'AuT+N2', name: '黄金 T+N2 / Au(T+N2)', price: null, changePercent: null, currency: 'CNY' },
  { symbol: 'Ag99.99', name: '白银99.99 / Ag99.99', price: null, changePercent: null, currency: 'CNY' },
  { symbol: 'AgT+D', name: '白银 T+D / Ag(T+D)', price: null, changePercent: null, currency: 'CNY' },
  { symbol: 'Pt99.95', name: '铂金99.95 / Pt99.95', price: null, changePercent: null, currency: 'CNY' },
];
  const [sortBy, setSortBy] = useState<'marketValue' | 'changePercent'>(() => {
  // 仅在客户端执行
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
  const [brandsList, setBrandsList] = useState<any[]>([]); // { id, name, logoUrl }
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const [selectedBrandName, setSelectedBrandName] = useState<string>('');
  const [loadingCarData, setLoadingCarData] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [convertedAssets, setConvertedAssets] = useState<Asset[]>([]);

  // 加载资产
  const loadAssets = useCallback(async () => {
    const userId = getCurrentUserId();
    if (!userId) {
      setAssets([]);
      setLoadingAssets(false);
      return;
    }

    // 检查缓存是否有效
    const cached = assetCache.get(userId);
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      console.log('[PortfolioPage] 使用缓存的资产数据，userId:', userId);
      setAssets(cached.assets);
      setLoadingAssets(false);
      return;
    }

    // 缓存无效，重新请求
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
      // 存入缓存
      assetCache.set(userId, {
        assets: normalizedData,
        timestamp: Date.now(),
      });
      setAssets(normalizedData);
    } catch (err) {
      console.error('加载资产失败', err);
      setAssets([]);
    } finally {
      setLoadingAssets(false);
    }
  }, []);

// 组件首次挂载时加载资产
useEffect(() => {
  loadAssets();
}, [loadAssets]); // 依赖 loadAssets，确保只在函数稳定时执行一次

  // 初始加载（仅一次，useEffect 依赖为空）
  useEffect(() => {
    loadAssets();
  }, [loadAssets]);


  useEffect(() => {
  console.log('当前资产类型:', assets.map(a => ({ symbol: a.symbol, type: a.type })));
}, [assets]);
  const { hasCrypto, hasStock, hasMetal, hasFund } = useMemo(() => {
  const types = assets.map(a => a.type);
  return {
    hasCrypto: types.includes('crypto'),
    hasStock: types.includes('stock') || types.includes('etf'),
    hasMetal: types.includes('metal'),
    hasFund: types.includes('fund'),
  };
}, [assets]);

// 调用自定义 Hook
// useAssetRefresh({ hasCrypto, hasStock, hasMetal, hasFund });

  const { currency } = useCurrency(); // 获取当前货币代码
  const { convert, loading: converting } = useCurrencyConverter(); // 转换函数和加载状态
  // 定义转换函数
  const convertAll = useCallback(async () => {
  setConvertingAssets(true); // 开始转换，显示骨架屏
  try {
    if (assets.length === 0) {
      setConvertedAssets([]);
      return;
    }

    console.log(`[货币转换] 开始转换，目标货币: ${currency}`);
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
    console.error('货币转换整体失败:', error);
  } finally {
    setConvertingAssets(false); // 无论成功或失败，结束转换
  }
}, [currency, convert, assets]); 

// 货币切换时自动转换
useEffect(() => {
  convertAll();
}, [currency, convertAll]); // 只在货币变化时执行

// ==================== 资产更新事件处理 ====================
useEffect(() => {
  const handleUpdate = (updatedAssets?: Asset[]) => {
    if (updatedAssets) {
      setAssets([...updatedAssets]);
      // 不更新 convertedAssets，等待货币切换或手动触发
    } else {
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [selectedAssetSymbol, setSelectedAssetSymbol] = useState<string | null>(null);
const [isDetailOpen, setIsDetailOpen] = useState(false);

// 打开详情抽屉的函数
const openAssetDetail = (symbol: string) => {
  setSelectedAssetSymbol(symbol);
  setIsDetailOpen(true);
};

// 关闭详情抽屉的函数
const closeAssetDetail = () => {
  setIsDetailOpen(false);
  // 可选：延迟清除 symbol 以配合动画
  setTimeout(() => setSelectedAssetSymbol(null), 300);
};
  
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

  // 计算单个资产的盈亏率（百分比）
  const getProfitPercent = (asset: Asset): number => {
  if (asset.costPrice && asset.costPrice > 0) {
    return ((asset.price - asset.costPrice) / asset.costPrice) * 100;
  }
  return 0; // 无成本价或成本价为0，视为0%
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

  useEffect(() => {
    const unsubscribe = eventBus.subscribe('userChanged', () => {
      loadAssets();
    });
    return () => unsubscribe();
  }, [loadAssets]);

  // 保存排序方式
  useEffect(() => {
  localStorage.setItem(SORT_BY_KEY, sortBy);
  }, [sortBy]);

// 保存排序顺序
useEffect(() => {
  localStorage.setItem(SORT_ORDER_KEY, sortOrder);
}, [sortOrder]);

// 保存隐藏的资产类型（Set 转换为数组）
useEffect(() => {
  const arr = Array.from(hiddenAssetTypes);
  localStorage.setItem(HIDDEN_TYPES_KEY, JSON.stringify(arr));
}, [hiddenAssetTypes]);

  const currencySymbolMap: Record<string, string> = {
    CNY: '¥',
    USD: '$',
  };

// 排序后的资产列表
const sortedAssets = useMemo(() => {
  return [...assets].sort((a, b) => {
    if (sortBy === 'marketValue') {
      return sortOrder === 'asc' ? a.marketValue - b.marketValue : b.marketValue - a.marketValue;
    } else {
      const aProfit = getProfitPercent(a);
      const bProfit = getProfitPercent(b);
      return sortOrder === 'asc' ? aProfit - bProfit : bProfit - aProfit;
    }
  });
}, [assets, sortBy, sortOrder]);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleDeleteAsset = async (symbol: string) => {
  try {
    const userId = getCurrentUserId();
    if (!userId) {
      console.warn('用户未登录');
      return;
    }
    const res = await fetch('/api/asset', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
      },
      body: JSON.stringify({ symbol }),
    });
    if (res.ok) {
      await loadAssets();
    } else {
      console.error('删除失败');
    }
  } catch (err) {
    console.error('删除资产失败', err);
  }
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
    if (!isNaN(holdingsNum) && holdingsNum > 0) {
      setMarketValue(holdingsNum * foundAsset.price);
    } else {
      setMarketValue(null);
    }
  } else {
    setMarketValue(null);
  }
}, [holdings, foundAsset?.price]);

  const handleMainCategoryClick = (category: MainCategory) => {
  if (category === 'custom') {
    // 直接进入现金添加页面
    setSelectedAssetType('custom');
    setView('search');
    setSearchQuery('');
    setFoundAsset(null);
    setSearchError(null);
    setHoldings("");
    setPurchaseDate("");
    setCostPrice("");
    setCashName('');
    setSelectedIcon('');
    // 重置其他相关状态
    setBrandsList([]);
    setSelectedBrandId('');
    setSelectedBrandName('');
  } else {
    setSelectedMainCategory(category);
    setView('subCategories');
  }
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
  // 直接使用 carBrands，它已经包含正确的字符串 id 和本地图片路径
  setBrandsList(carBrands);
  setSelectedBrandId('');
  setSelectedBrandName('');
  setLoadingCarData(false); // 如果有 loading 状态，可以结束
}

    if (type === 'real_estate') {
  setRealEstateName('');
  setRealEstateIncludeInChart(true);
  setRealEstateNotes('');
  setRealEstateQuantity('1');
}

if (type === 'custom') {
  setCashName('');
  // holdings, purchaseDate 等已在函数开头重置
}
  };

  const handleBack = () => {
  if (view === 'subCategories') {
    setView('categories');
    setSelectedMainCategory(null);
  } else if (view === 'search') {
    if (selectedAssetType === 'custom') {
      // 现金直接返回主菜单
      setView('categories');
      setSelectedMainCategory(null);
      setSelectedAssetType(null);
      // 重置现金表单
      setCashName('');
      setSelectedIcon('');
    } else if (selectedAssetType === 'custom_asset') {
      setView('categories');
  setSelectedMainCategory(null);
  setSelectedAssetType(null);
  // 重置自定义资产表单
  setCustomAssetType('');
  setCustomAssetName('');
  setCustomAssetAmount('');
  setCustomAssetOrderDate('');
  setCustomAssetNotes('');
  setCustomAssetIncludeInChart(true);
    }
      else {
      setView('subCategories');
      setSelectedAssetType(null);
    }
    // 重置所有搜索相关状态
    setFoundAsset(null);
    setSearchQuery('');
    setSearchError(null);
    setHoldings("");
    setPurchaseDate("");
    setCostPrice("");
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
      
      // 判断是否为 A 股
      const isAStock = /^\d{6}$/.test(cleanSymbol) && 
                       (data.symbol.includes('.SS') || data.symbol.includes('.SZ'));
      
      if (isAStock) {
        // 主 Logo 使用东方财富
        logoUrl = `https://static.futunn.com/project/stock_company_logo/${cleanSymbol}.png`;
      } else if (cleanSymbol && process.env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID) {
        // 美股等其他市场
        logoUrl = `https://cdn.brandfetch.io/ticker/${cleanSymbol}?c=${process.env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID}`;
      }
    } else if (data.type === 'crypto') {
      // 加密货币 Logo 逻辑保持不变
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
  
    if (data.symbol.includes('.HK') || (data.market && data.market.includes('Hong Kong'))) {
      data.currency = data.currency || 'HKD';
    }

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

  // 汽车添加处理（纯手动输入）
  const handleAddCarAsset = async () => {
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
      currency: currency,
      lastUpdated: new Date().toISOString(),
      type: 'car',
      changePercent: 0,
      logoUrl: logoUrl,
      purchaseDate: purchaseDate || undefined,
      costPrice: price,
    };

    try {
         const userId = getCurrentUserId();
if (!userId) {
  alert('请先登录');
  return;
}
const res = await fetch('/api/asset', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-user-id': userId,
  },
  body: JSON.stringify(newAsset),
});
  if (res.ok) {
    await loadAssets(); // 重新加载资产列表
    // 重置表单...
  } else {
    console.error('添加失败');
  }
} catch (err) {
  console.error('添加汽车资产失败', err);
}

    //alert(`已添加汽车资产: ${carName}`);

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

  const handleAddRealEstateAsset = async () => {
  const name = realEstateName.trim() || '不动产';
  const quantity = parseFloat(realEstateQuantity) || 1;
  const pricePerUnit = parseFloat(holdings) || 0;
  const total = quantity * pricePerUnit;
  if (quantity <= 0 || pricePerUnit <= 0) {
    alert('请输入有效的数量和单价');
    return;
  }

  const newAsset: Asset = {
    symbol: `REAL_ESTATE-${Date.now()}`,
    name: name,
    price: pricePerUnit,
    holdings: quantity,
    marketValue: total,
    currency: currency,
    lastUpdated: new Date().toISOString(),
    type: 'real_estate',
    changePercent: 0,
    purchaseDate: purchaseDate || undefined,
    costPrice: pricePerUnit,
  };

  try {
    const userId = getCurrentUserId();
    if (!userId) {
      alert('请先登录');
      return;
    }
    const res = await fetch('/api/asset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
      },
      body: JSON.stringify(newAsset),
    });
    if (res.ok) {
      await loadAssets(); // 重新加载资产列表
      // 重置表单
      setRealEstateName('');
      setRealEstateIncludeInChart(true);
      setRealEstateNotes('');
      setHoldings('');
      setPurchaseDate('');
      setRealEstateQuantity('1');
      setView('categories');
      setSelectedMainCategory(null);
      setSelectedAssetType(null);
      setShowMenu(false);
    } else {
      console.error('添加失败');
    }
  } catch (err) {
    console.error('添加房产资产失败', err);
  }
};

const handleAddCashAsset = async () => {
  const name = cashName.trim() || '现金';
  const amount = parseFloat(holdings) || 0;
  if (amount <= 0) {
    alert('请输入有效的金额');
    return;
  }

  const newAsset: Asset = {
    symbol: `CASH-${Date.now()}`,
    name: name,
    price: amount,
    holdings: 1,
    marketValue: amount,
    currency: currency,
    lastUpdated: new Date().toISOString(),
    type: 'custom',
    changePercent: 0,
    purchaseDate: purchaseDate || undefined,
    costPrice: amount,
    logoUrl: selectedIcon ? `/icons/payment/${selectedIcon}` : undefined,
  };

  try {
    const userId = getCurrentUserId();
    if (!userId) {
      alert('请先登录');
      return;
    }
    const res = await fetch('/api/asset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
      },
      body: JSON.stringify(newAsset),
    });
    if (res.ok) {
      await loadAssets();
      // 重置状态
      setCashName('');
      setSelectedIcon('');
      setHoldings('');
      setPurchaseDate('');
      setCostPrice('');
      setView('categories');
      setSelectedMainCategory(null);
      setSelectedAssetType(null);
      setShowMenu(false);
    } else {
      console.error('添加失败');
    }
  } catch (err) {
    console.error('添加现金资产失败', err);
  }
};

const handleAddCustomAsset = async () => {
  if (!customAssetType) return;
  const name = customAssetName.trim();
  const amount = parseFloat(customAssetAmount);
  if (!name) {
    alert('请输入资产名称');
    return;
  }
  if (amount <= 0) {
    alert('请输入有效的金额');
    return;
  }

  const isLiability = customAssetType === 'liability';
  const finalAmount = isLiability ? -amount : amount;

  const newAsset: Asset = {
    symbol: `CUSTOM-${Date.now()}`,
    name: name,
    price: finalAmount,
    holdings: 1,
    marketValue: finalAmount,
    currency: currency,
    lastUpdated: new Date().toISOString(),
    type: customAssetType,
    changePercent: 0,
    purchaseDate: customAssetOrderDate || undefined,
    costPrice: finalAmount,
    notes: customAssetNotes || undefined,
    includeInChart: customAssetIncludeInChart,
  };

  try {
    const userId = getCurrentUserId();
    if (!userId) {
      alert('请先登录');
      return;
    }
    const res = await fetch('/api/asset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
      },
      body: JSON.stringify(newAsset),
    });
    if (res.ok) {
      await loadAssets();
      // 重置状态
      setCustomAssetType('');
      setCustomAssetName('');
      setCustomAssetAmount('');
      setCustomAssetOrderDate('');
      setCustomAssetNotes('');
      setCustomAssetIncludeInChart(true);
      setView('categories');
      setSelectedMainCategory(null);
      setSelectedAssetType(null);
      setShowMenu(false);
    } else {
      console.error('添加失败');
    }
  } catch (err) {
    console.error('添加自定义资产失败', err);
  }
};

const handleAddAsset = async () => {
  if (!foundAsset || !holdings) return;

  // 确保价格有效
  if (foundAsset.price == null || isNaN(foundAsset.price)) {
    alert('获取价格失败，请稍后重试');
    return;
  }

  const holdingsNum = parseFloat(holdings);
  const finalMarketValue = !isNaN(holdingsNum) && holdingsNum > 0 ? holdingsNum * foundAsset.price : 0;

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

  try {
    const userId = getCurrentUserId();
    if (!userId) {
      alert('请先登录');
      return;
    }
    const res = await fetch('/api/asset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
      },
      body: JSON.stringify(newAsset),
    });
    if (res.ok) {
      await loadAssets();
      // 重置表单
      setFoundAsset(null);
      setSearchQuery('');
      setHoldings("");
      setPurchaseDate("");
      setCostPrice("");
      setView('categories');
      setSelectedMainCategory(null);
      setSelectedAssetType(null);
      setShowMenu(false);
    } else {
      alert('添加失败');
    }
  } catch (err) {
    console.error('添加资产失败', err);
  }

  if (foundAsset.logoUrl) {
    cacheLogo(foundAsset.symbol, foundAsset.logoUrl).catch(console.warn);
  }

  // 如果是股票或ETF，异步拉取历史数据
  if (newAsset.type === 'stock' || newAsset.type === 'etf') {
    fetch('/api/history/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset: { type: newAsset.type, symbol: newAsset.symbol } })
    }).catch(err => console.error(`拉取 ${newAsset.symbol} 历史数据失败:`, err));
  }
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
          <p className="text-xs text-blue-600/70 dark:text-blue-400/70 font-medium">美股、A股、港股、ETF</p>
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
                <p className="font-bold text-blue-900 dark:text-blue-300 text-lg">不动产</p>
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
                <CarFront size={24} />
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
      <Banknote size={24} /> {/* 改为现金图标 */}
    </div>
    <div className="text-left">
      <p className="font-bold text-blue-900 dark:text-blue-300 text-lg">现金</p >
      <p className="text-xs text-blue-600/70 dark:text-blue-400/70 font-medium">现金、活期存款</p >
    </div>
  </div>
  <ChevronRight className="text-blue-300 dark:text-blue-500 group-active:translate-x-1 transition-transform" />
</button>
      )}
    </div>
  </div>
);

// 可选的图标列表：文件名和显示名称
const networkIcons = [
  { name: '支付宝', file: 'alipay.png' },
  { name: '微信', file: 'wechat.png' },
  { name: 'Apple', file: 'applepay.png' },
  { name: 'PayPal', file: 'paypal.png' },
  { name: 'e-CNY', file: 'e-CNY.png' },
];

// 银行账户图标（根据你的实际文件调整）
const bankIcons = [
  { name: 'ICBC', file: 'icbc.png' },
  { name: 'ABC', file: 'abc.png'},
  { name: 'BOC', file: 'boc.png'},
  { name: 'CCB', file: 'ccb.png'},
  { name: 'CMB', file: 'cmb.png'},
  { name: 'PAB', file: 'pab.png'},
];
const allIcons = [...networkIcons, ...bankIcons];

// 图标分组
const iconGroups = [
  { title: '网络账户', icons: networkIcons },
  { title: '银行帐户', icons: bankIcons },
];

const renderCarForm = () => {
  // 获取当前选中的品牌对象
  const selectedBrand = selectedBrandId ? brandsList.find(b => b.id === selectedBrandId) : null;

  return (
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
          {/* 品牌选择按钮（已优化：左侧显示Logo，右侧箭头） */}
          <div>
            <label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">品牌</label>
            <button
              onClick={() => setShowBrandSelector(true)}
              className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-left text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-blue-500 flex items-center justify-between"
            >
              <div className="flex items-center gap-2 truncate">
                {selectedBrand?.logoUrl && (
                  <img
                    src={selectedBrand.logoUrl}
                    alt={selectedBrandName}
                    className="w-6 h-6 object-contain flex-shrink-0"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                )}
                <span className="truncate">{selectedBrandName || '选择品牌'}</span>
              </div>
              <ChevronDown size={20} className="text-gray-500 flex-shrink-0" />
            </button>
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

          {/* 车型下方的Logo预览框已移除，现在Logo仅显示在品牌选择按钮内 */}
        </div>
      </div>

      {/* 持有数量、买入日期、买入价等输入框保持不变 */}
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
          <label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">买入价值</label>
          <input
            type="number"
            placeholder="20.00"
            className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-blue-500"
            value={costPrice}
            onChange={(e) => setCostPrice(e.target.value)}
            step="0.01"
          />
        </div>

        <button
          onClick={handleAddCarAsset}
          disabled={!selectedBrandId || !holdings}
          className="w-full bg-blue-600 text-white font-black py-4 rounded-[20px] shadow-lg shadow-blue-200 dark:shadow-blue-900/20 active:scale-[0.98] transition-all disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
        >
          确认添加汽车
        </button>
      </div>

      {showBrandSelector && (
        <BrandSelector
          brands={brandsList}
          onSelect={(brand) => {
            setSelectedBrandId(brand.id);
            setSelectedBrandName(brand.name);
            setShowBrandSelector(false);
          }}
          onClose={() => setShowBrandSelector(false)}
        />
      )}
    </div>
  );
};

const renderRealEstateForm = () => (
  <div className="bg-white dark:bg-[#0a0a0a] border-2 border-blue-500 p-6 rounded-[32px] shadow-xl shadow-blue-50 dark:shadow-blue-900/20 animate-in zoom-in-95 duration-300">
    <div className="flex flex-col gap-2 mb-6">
      <div className="flex items-center gap-2">
        <span className="bg-yellow-600 text-[10px] text-white px-2 py-0.5 rounded-md font-bold uppercase">
          不动产
        </span>
      </div>

      <div className="space-y-4">
        {/* 自定名称 */}
        <div>
          <label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">
            自定名称
          </label>
          <input
            type="text"
            placeholder="默认为不动产"
            className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-blue-500"
            value={realEstateName}
            onChange={(e) => setRealEstateName(e.target.value)}
          />
        </div>

        {/* 买入日期 */}
        <div>
          <label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">
            买入日期
          </label>
          <input
            type="date"
            className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-blue-500 appearance-none"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
          />
        </div>

        {/* 持有数量 */}
        <div>
          <label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">
            持有数量
          </label>
          <input
            type="number"
            placeholder="1"
            className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-blue-500"
            value={realEstateQuantity}
            onChange={(e) => setRealEstateQuantity(e.target.value)}
            step="1"
            min="1"
          />
        </div>

        {/* 单价 */}
        <div>
          <label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">
            持有价值
          </label>
          <input
            type="number"
            placeholder="0.00"
            className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-blue-500"
            value={holdings}
            onChange={(e) => setHoldings(e.target.value)}
            step="0.01"
            min="0"
          />
        </div>

        {/* 计入图表开关 */}
        <div className="flex items-center justify-between">
          <label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">
            计入图表
          </label>
          <button
            onClick={() => setRealEstateIncludeInChart(!realEstateIncludeInChart)}
            className={`w-12 h-6 rounded-full transition-colors ${
              realEstateIncludeInChart ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <div
              className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${
                realEstateIncludeInChart ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* 备注 */}
        <div>
          <label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">
            备注
          </label>
          <input
            type="text"
            placeholder="可选"
            className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-blue-500"
            value={realEstateNotes}
            onChange={(e) => setRealEstateNotes(e.target.value)}
          />
        </div>
      </div>
    </div>

    <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
      <button
        onClick={handleAddRealEstateAsset}
        disabled={!holdings || parseFloat(holdings) <= 0 || !realEstateQuantity || parseFloat(realEstateQuantity) <= 0}
        className="w-full bg-blue-600 text-white font-black py-4 rounded-[20px] shadow-lg shadow-blue-200 dark:shadow-blue-900/20 active:scale-[0.98] transition-all disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
      >
        确认添加
      </button>
    </div>
  </div>
);

const renderCashForm = () => (
  <div className="bg-white dark:bg-[#0a0a0a] border-2 border-blue-500 p-6 rounded-[32px] shadow-xl shadow-blue-50 dark:shadow-blue-900/20 animate-in zoom-in-95 duration-300">
    <div className="flex flex-col gap-2 mb-6">
      <div className="flex items-center gap-2">
        <span className="bg-green-600 text-[10px] text-white px-2 py-0.5 rounded-md font-bold uppercase">
          现金
        </span>
      </div>

      <div className="space-y-4">
        {/* 自定名称（可选） */}
        <div>
          <label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">
            名称（可选）
          </label>
          <input
            type="text"
            placeholder="默认为现金"
            className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-blue-500"
            value={cashName}
            onChange={(e) => setCashName(e.target.value)}
          />
        </div>

        {/* 图标选择（按钮形式） */}
<div>
  <label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">
    选择图标（可选）
  </label>
  <button
    onClick={() => setShowIconPage(true)}
    className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-left text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-blue-500 flex items-center justify-between"
  >
    <div className="flex items-center gap-2">
      {selectedIcon ? (
        <img
          src={`/icons/payment/${selectedIcon}`}
          alt=""
          className="w-6 h-6 object-contain rounded-lg"
          onError={(e) => (e.currentTarget.style.display = 'none')}
        />
      ) : (
        <Banknote size={20} className="text-gray-500" />
      )}
      <span className="truncate">
  {selectedIcon ? allIcons.find(i => i.file === selectedIcon)?.name || '已选择' : '点击选择图标'}
</span>
    </div>
    <ChevronDown size={20} className="text-gray-500 flex-shrink-0" />
  </button>
</div>

        {/* 金额 */}
        <div>
          <label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">
            金额
          </label>
          <input
            type="number"
            placeholder="0.00"
            className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-blue-500"
            value={holdings}
            onChange={(e) => setHoldings(e.target.value)}
            step="0.01"
            min="0"
          />
        </div>

        {/* 存入日期 */}
        <div>
          <label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">
            存入日期
          </label>
          <input
            type="date"
            className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-blue-500 appearance-none"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
          />
        </div>
      </div>
    </div>

    <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
      <button
        onClick={handleAddCashAsset}
        disabled={!holdings || parseFloat(holdings) <= 0}
        className="w-full bg-blue-600 text-white font-black py-4 rounded-[20px] shadow-lg shadow-blue-200 dark:shadow-blue-900/20 active:scale-[0.98] transition-all disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
      >
        确认添加
      </button>
    </div>
  </div>
);

// 资产子类型选项（用于下拉框）
const assetTypeOptions = [
  { value: '', label: '点击选择类型', disabled: true },
  { value: 'custom_asset', label: '自定义资产类型' },
  { value: 'stock', label: '股票' },
  { value: 'fund', label: '基金' },
  { value: 'crypto', label: '加密货币' },
  { value: 'metal', label: '贵金属' },
  { value: 'receivable', label: '应收款' },
  { value: 'liability', label: '负债' },
];

const getAssetTypeIcon = (type: string, size: number = 24) => {
  switch (type) {
    case 'stock': return <TrendingUp size={size} className="text-blue-600" />;
    case 'fund': return <PieChart size={size} className="text-green-600" />;
    case 'crypto': return <Bitcoin size={size} className="text-purple-600" />;
    case 'metal': return <Blocks size={size} className="text-yellow-600" />;
    case 'real_estate': return <Hotel size={size} className="text-orange-600" />;
    case 'car': return <CarFront size={size} className="text-cyan-600" />;
    case 'custom': return <Banknote size={size} className="text-green-600" />;
    case 'receivable': return <Receipt size={size} className="text-indigo-600" />;
    case 'custom_asset': return <Activity size={size} className="text-purple-600" />;
    case 'liability': return <ReceiptText size={size} className="text-red-600" />;
    default: return null;
  }
};

const renderCustomAssetForm = () => (
  <div className="bg-white dark:bg-[#0a0a0a] border-2 border-blue-500 p-6 rounded-[32px] shadow-xl shadow-blue-50 dark:shadow-blue-900/20 animate-in zoom-in-95 duration-300">
    <div className="flex flex-col gap-2 mb-6">
      <div className="flex items-center gap-2">
        <span className="bg-purple-600 text-[10px] text-white px-2 py-0.5 rounded-md font-bold uppercase">
          自定义
        </span>
      </div>

      <div className="space-y-4">
        {/* 资产类型选择 */}
<div>
  <label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">资产类型</label>
  <div className="flex items-center gap-3 relative">
    {/* 图标预览框 */}
    <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center flex-shrink-0">
      {customAssetType ? getAssetTypeIcon(customAssetType, 28) : <Activity size={28} className="text-gray-400" />}
    </div>
    {/* 选择器（隐藏原生箭头） */}
    <select
      value={customAssetType}
      onChange={(e) => setCustomAssetType(e.target.value)}
      className="flex-1 bg-gray-50 dark:bg-[#1a1a1a] pl-4 pr-10 py-4 rounded-2xl font-bold text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-blue-500 appearance-none"
    >
      {assetTypeOptions.map(option => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
    {/* 自定义向下箭头 */}
    <ChevronDown
      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
      size={20}
    />
  </div>
</div>

        {/* 资产名称 */}
        <div>
          <label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">资产名称</label>
          <input
            type="text"
            placeholder="自定义资产名称"
            className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-blue-500"
            value={customAssetName}
            onChange={(e) => setCustomAssetName(e.target.value)}
          />
        </div>

        {/* 金额 */}
        <div>
          <label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">金额</label>
          <input
            type="number"
            placeholder="0.00"
            className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-blue-500"
            value={customAssetAmount}
            onChange={(e) => setCustomAssetAmount(e.target.value)}
            step="0.01"
            min="0"
          />
        </div>

        {/* 订单时间 */}
        <div>
          <label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">订单时间</label>
          <input
            type="date"
            className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-blue-500 appearance-none"
            value={customAssetOrderDate}
            onChange={(e) => setCustomAssetOrderDate(e.target.value)}
          />
        </div>

        {/* 备注（可选） */}
        <div>
          <label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">备注</label>
          <input
            type="text"
            placeholder="可选"
            className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-blue-500"
            value={customAssetNotes}
            onChange={(e) => setCustomAssetNotes(e.target.value)}
          />
        </div>

        {/* 计入图表开关 */}
        <div className="flex items-center justify-between">
          <label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">计入图表</label>
          <button
            onClick={() => setCustomAssetIncludeInChart(!customAssetIncludeInChart)}
            className={`w-12 h-6 rounded-full transition-colors ${
              customAssetIncludeInChart ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <div
              className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${
                customAssetIncludeInChart ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>
    </div>

    <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
      <button
        onClick={handleAddCustomAsset}
        disabled={!customAssetName.trim() || !customAssetAmount || parseFloat(customAssetAmount) <= 0}
        className="w-full bg-blue-600 text-white font-black py-4 rounded-[20px] shadow-lg shadow-blue-200 dark:shadow-blue-900/20 active:scale-[0.98] transition-all disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
      >
        确认添加
      </button>
    </div>
  </div>
);
const renderSearch = () => {
  // 汽车类型（保持原有逻辑）
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

  // 贵金属类型
  if (selectedAssetType === 'metal') {
  return (
    <div
      ref={scrollContainerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      className="flex flex-col animate-in fade-in slide-in-from-right duration-300 max-h-[70vh] overflow-y-auto overflow-x-hidden px-1"
    >
      <div className="flex items-center gap-4 mb-8">
        <button onClick={handleBack} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-500 dark:text-gray-300">
          <ArrowLeft size={20} />
        </button>
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">添加贵金属</h3>
      </div>


      {/* 选择贵金属下拉框 */}
      <div className="mb-6">
  <label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">选择贵金属</label>
  <div className="relative">
    <select
      className="w-full bg-gray-50 dark:bg-[#1a1a1a] px-3 py-4 rounded-2xl mt-1 font-bold text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-blue-500 appearance-none"
      value={foundAsset?.symbol || ''}
      onChange={async (e) => {
        const selectedSymbol = e.target.value;
        if (!selectedSymbol) {
          setFoundAsset(null);
          return;
        }
        setIsLoadingMetal(true);
        setMetalError(null);
        setFoundAsset(null);
        try {
          const response = await fetch(`/api/search?symbol=${encodeURIComponent(selectedSymbol)}&type=metal`);
          const data = await response.json();
          if (!response.ok || !data.success) {
            throw new Error(data.error || '获取贵金属数据失败');
          }
          setFoundAsset({
            symbol: data.symbol,
            name: data.name,
            price: data.price,
            changePercent: data.changePercent,
            market: data.market || '贵金属',
            currency: data.currency || 'CNY',
            type: 'metal',
            source: data.source,
            logoUrl: undefined,
          });
          setHoldings("");
          setPurchaseDate("");
          setCostPrice("");
          setMarketValue(null);
        } catch (err: any) {
          setMetalError(err.message);
        } finally {
          setIsLoadingMetal(false);
        }
      }}
    >
      <option value="">请选择贵金属</option>
      {metalOptions.map(metal => (
        <option key={metal.symbol} value={metal.symbol}>{metal.name}</option>
      ))}
    </select>
    {/* 自定义箭头，调整 right 值控制水平位置 */}
    <ChevronDown
      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
      size={20}
    />
  </div>
</div>

      {/* 加载中状态 */}
      {isLoadingMetal && (
        <div className="flex justify-center py-10">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      )}

      {/* 错误提示 */}
      {metalError && (
        <div className="text-center py-10">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-red-500 font-bold">{metalError}</p >
        </div>
      )}

      {/* 如果已选择贵金属且加载完成，显示卡片 */}
      {foundAsset && !isLoadingMetal && (
        <div className="bg-white dark:bg-[#0a0a0a] border-2 border-blue-500 p-6 rounded-[32px] shadow-xl shadow-blue-50 dark:shadow-blue-900/20 animate-in zoom-in-95 duration-300 -mx-0.5">
          {/* 卡片内容保持不变 */}
          <div className="flex flex-col gap-2 mb-6">
            <div className="flex items-center gap-2">
              <span className="bg-blue-600 text-[10px] text-white px-2 py-0.5 rounded-md font-bold uppercase">
                贵金属
              </span>
              <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">
                {foundAsset.type?.toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <h4 className="text-3xl font-black text-gray-900 dark:text-gray-100">{foundAsset.name}</h4>
              <div className="text-right">
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
            <p className="text-sm font-bold text-gray-400 dark:text-gray-500">{foundAsset.symbol}</p >
          </div>

          {/* 三个输入框 */}
          <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            <div>
              <label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">持有数量 (克)</label>
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
              <label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">买入价 (每克)</label>
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
      )}

      {!foundAsset && !isLoadingMetal && !metalError && (
        <div className="text-center py-10">
          <p className="text-gray-400 dark:text-gray-500">请先选择贵金属</p >
        </div>
      )}
    </div>
  );
}

// 房产类型
if (selectedAssetType === 'real_estate') {
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
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">添加不动产</h3>
      </div>
      <div className="min-h-[200px]">{renderRealEstateForm()}</div>
    </div>
  );
}

if (selectedAssetType === 'custom') {
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
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">添加现金</h3>
      </div>
      <div className="min-h-[200px]">{renderCashForm()}</div>
    </div>
  );
}

if (selectedAssetType === 'custom_asset') {
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
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">添加自定义</h3>
      </div>
      <div className="min-h-[200px]">{renderCustomAssetForm()}</div>
    </div>
  );
}

  // 其他类型（股票、基金、加密货币、房产）的搜索界面保持不变
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
          {selectedAssetType === 'stock' && '支持美股 (AAPL)、A股 (600519)、港股(9988)'}
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
            <p className="text-gray-300 dark:text-gray-600 font-bold italic">未找到该代码，请确保输入正确</p >
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">尝试输入其他代码</p >
          </div>
        ) : null}
      </div>
    </div>
  );
};

  return (
  <>
    <main className="min-h-screen bg-gray-50 dark:bg-black p-4 relative">
      <header className="flex justify-between items-center mb-6 px-2">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">资产管理</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">管理并添加您的各类投资项目</p>
        </div>
        <button
          onClick={() => setShowSortMenu(!showSortMenu)}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
        >
          <ListFilterPlus className="w-6 h-6 text-gray-600 dark:text-gray-300" />
        </button>
      </header>

      {converting && <div className="text-xs text-blue-500 text-center py-1">汇率更新中...</div>}

      {/* 排序菜单 */}
      {showSortMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowSortMenu(false)} />
          <div className="absolute right-4 top-20 z-50 bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-2 w-[160px] sm:min-w-[200px] max-w-[90vw]">
            {/* 排序方式标题行 */}
            <div
              className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              onClick={() => setSortExpanded(!sortExpanded)}
            >
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">排序方式</span>
              <ChevronDown className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${sortExpanded ? '' : '-rotate-90'}`} />
            </div>
            {sortExpanded && (
  <>
    {/* 持有额 */}
    <div className="flex items-center justify-between px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
      <span 
        onClick={() => {
          if (sortBy === 'marketValue') {
            setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
          } else {
            setSortBy('marketValue');
            setSortOrder('desc');
          }
        }}
        className="cursor-pointer"
      >
        持有额
      </span>
      <button
        onClick={() => {
          if (sortBy === 'marketValue') {
            setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
          } else {
            setSortBy('marketValue');
            setSortOrder('desc');
          }
        }}
        className="cursor-pointer p-0 focus:outline-none"
      >
        {sortBy === 'marketValue' && sortOrder === 'asc' ? (
          <ChevronUp size={16} className="text-blue-500" />
        ) : sortBy === 'marketValue' && sortOrder === 'desc' ? (
          <ChevronDown size={16} className="text-blue-500" />
        ) : (
          <ChevronDown size={16} className="text-gray-400 hover:text-gray-600" />
        )}
      </button>
    </div>

    {/* 盈亏率 */}
    <div className="flex items-center justify-between px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
      <span 
        onClick={() => {
          if (sortBy === 'changePercent') {
            setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
          } else {
            setSortBy('changePercent');
            setSortOrder('desc');
          }
        }}
        className="cursor-pointer"
      >
        盈亏率
      </span>
      <button
        onClick={() => {
          if (sortBy === 'changePercent') {
            setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
          } else {
            setSortBy('changePercent');
            setSortOrder('desc');
          }
        }}
        className="cursor-pointer p-0 focus:outline-none"
      >
        {sortBy === 'changePercent' && sortOrder === 'asc' ? (
          <ChevronUp size={16} className="text-blue-500" />
        ) : sortBy === 'changePercent' && sortOrder === 'desc' ? (
          <ChevronDown size={16} className="text-blue-500" />
        ) : (
          <ChevronDown size={16} className="text-gray-400 hover:text-gray-600" />
        )}
      </button>
    </div>
  </>
)}

            <div className="border-t border-gray-200 dark:border-gray-700 my-2"></div>
            {/* 筛选资产标题行 */}
            <div
              className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              onClick={() => setFilterExpanded(!filterExpanded)}
            >
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">展示设置</span>
              <ChevronDown className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${filterExpanded ? '' : '-rotate-90'}`} />
            </div>
            {filterExpanded && (
              <div className="mt-2 space-y-1">
                {allAssetTypes.length > 0 ? (
                  allAssetTypes.map(type => {
                    const config = ASSET_TYPE_CONFIG[type] || { name: type };
                    return (
                      <button
                        key={type}
                        onClick={() => {
                          const newHidden = new Set(hiddenAssetTypes);
                          if (newHidden.has(type)) {
                            newHidden.delete(type);
                          } else {
                            newHidden.add(type);
                          }
                          setHiddenAssetTypes(newHidden);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                          hiddenAssetTypes.has(type)
                            ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                            : 'bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700'
                        }`}
                      >
                        {config.name}
                      </button>
                    );
                  })
                ) : (
                  <div className="text-sm text-gray-500 dark:text-gray-400 px-3 py-2">暂无资产</div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* 资产卡片列表 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {(loadingAssets || convertingAssets) ? (
           // 骨架屏：5个占位卡片
            Array(5).fill(0).map((_, i) => (
             <div key={i} className="bg-white dark:bg-[#0a0a0a] p-3 rounded-[20px] shadow-sm shadow-blue-200 dark:shadow-black/50 overflow-hidden">
               <div className="flex justify-between items-start gap-1.5">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                 <div className="w-6 h-6 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
                  <div className="flex-1">
                   <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 animate-pulse mb-1" />
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse" />
                  </div>
                </div>
                 <div className="text-right flex-shrink-0">
                  <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse mb-1" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12 animate-pulse" />
                 </div>
                </div>
               <div className="mt-2 border-t border-gray-100 dark:border-gray-800 pt-2 flex justify-between items-center">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 animate-pulse" />
             <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-12 animate-pulse" />
            </div>
            </div>
         ))
        ) : filteredAndSortedAssets.length > 0 ? (
         filteredAndSortedAssets.map(asset => {
  console.log(`渲染 ${asset.symbol} 价格: ${asset.price}`);
  const profitLossColor = getProfitLossColor(asset);
  const profitLossSmallColor = getProfitLossSmallColor(asset);
  let displayPercent = Number(asset.changePercent) || 0;
  let displayPercentSign = displayPercent > 0 ? '+' : '';
  if (asset.costPrice && asset.costPrice > 0) {
    const calculatedPercent = ((Number(asset.price) - Number(asset.costPrice)) / Number(asset.costPrice)) * 100;
    displayPercent = calculatedPercent;
    displayPercentSign = calculatedPercent > 0 ? '+' : '';
  }

  const cachedLogo = getCachedLogo(asset.symbol);
  const logoSrc = cachedLogo || asset.logoUrl;

  // 判断是否为需要简化显示的资产类型
  const isSimpleAsset = ['car', 'custom', 'liability' ].includes(asset.type);

  // ✅ 计算安全的市值，放在 return 之前
  const safeMarketValue = 
    asset.marketValue != null && !isNaN(asset.marketValue) && isFinite(asset.marketValue)
      ? asset.marketValue
      : asset.holdings * asset.price;

    return (
      <div
        key={asset.symbol}
        onClick={() => openAssetDetail(asset.symbol)}
        className="cursor-pointer"
      >
        <div className="bg-white dark:bg-[#0a0a0a] p-3 rounded-[20px] shadow-sm shadow-blue-200 dark:shadow-black/50 overflow-hidden hover:shadow-md transition-all cursor-pointer">
          <div className="flex justify-between items-start gap-1.5">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="flex-shrink-0">
                {(() => {
                  const isAStock = asset.symbol && /^\d{6}\.(SS|SZ)$/.test(asset.symbol);
                  const code = isAStock ? asset.symbol.split('.')[0] : null;
                  const cachedLogo = getCachedLogo(asset.symbol);

                  if (isAStock && code) {
  const localPath = `/images/company_logos/${code}.png`;
  return (
    <div className="relative w-6 h-6">
      <img
        src={localPath}
        alt={asset.name}
        className="w-6 h-6 object-contain rounded-lg absolute inset-0"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
          const parent = e.currentTarget.parentElement;
          if (parent) {
            const icon = parent.querySelector('.stock-fallback-icon');
            if (icon) (icon as HTMLElement).style.display = 'block';
          }
        }}
      />
      <TrendingUp 
        size={16} 
        className="stock-fallback-icon w-6 h-6 text-gray-700 dark:text-gray-200 absolute inset-0 hidden"
      />
    </div>
  );
}

                  if (cachedLogo || asset.logoUrl) {
                    return (
                      <img
                        src={cachedLogo || asset.logoUrl}
                        alt={asset.name}
                        className="w-6 h-6 object-contain rounded-lg"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                    );
                  }

                  if (asset.type === 'car') {
  // 如果有自定义图标（品牌 logo），显示图片；否则显示默认 CarFront 图标
  if (asset.logoUrl) {
    return (
      <img
        src={asset.logoUrl}
        alt={asset.name}
        className="w-6 h-6 object-contain rounded-lg"
        onError={(e) => (e.currentTarget.style.display = 'none')}
      />
    );
  }
  return <CarFront size={16} className="text-gray-700 dark:text-gray-200" />;
}
                  if (asset.type === 'stock') return <Zap size={16} className="text-gray-700 dark:text-gray-200" />;
                  if (asset.type === 'metal') {
                    return asset.symbol && asset.symbol.includes('Ag') ? (
                      < img src={`/icons/silver-bar-${theme}.png`} alt="Silver" className="w-6 h-6 object-contain rounded-lg" />
                    ) : (
                      < img src={`/icons/gold-bar-${theme}.png`} alt="Gold" className="w-6 h-6 object-contain rounded-lg" />
                    );
                  }
                  if (asset.type === 'real_estate') return <Hotel size={16} className="text-gray-700 dark:text-gray-200" />;
                  if (asset.type === 'custom') {
  // 如果有自定义图标，显示图片；否则显示默认 Banknote 图标
  if (asset.logoUrl) {
    return (
      <img
        src={asset.logoUrl}
        alt=""
        className="w-6 h-6 object-contain rounded-lg"
        onError={(e) => (e.currentTarget.style.display = 'none')}
      />
    );
  }
  return (
    <div className="w-6 h-6 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
      <Banknote size={16} className="text-gray-700 dark:text-gray-200" />
    </div>
  );
}
                  if (asset.type === 'receivable') return <Receipt size={16} className="text-gray-700 dark:text-gray-200" />;
                  if (asset.type === 'custom_asset') return <Activity size={16} className="text-gray-700 dark:text-gray-200" />;
                  if (asset.type === 'liability') return <ReceiptText size={16} className="text-gray-700 dark:text-gray-200" />;
                  return <BarChart3 size={16} className="text-gray-700 dark:text-gray-200" />;
                })()}
              </div>
              <div className="text-left min-w-0 flex-1">
                <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 line-clamp-1 break-words" title={asset.name}>
                  {asset.name}
                </h4>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate" title={asset.symbol}>
                  {asset.type === 'real_estate' || asset.type === 'car' ? (
                    (() => {
                      const lastDashIndex = asset.symbol.lastIndexOf('-');
                      if (lastDashIndex !== -1) {
                        const timestampStr = asset.symbol.substring(lastDashIndex + 1);
                        const timestamp = parseInt(timestampStr, 10);
                        if (!isNaN(timestamp)) {
                          const date = new Date(timestamp);
                          if (!isNaN(date.getTime())) {
                            return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
                          }
                        }
                      }
                      return asset.symbol;
                    })()
                  ) : (
                    asset.symbol
                  )}
                </p >
              </div>
            </div>
            <div className="text-right flex-shrink-0 max-w-[90px]">
<p className={`text-base font-black truncate ${profitLossColor}`} title={`${safeMarketValue.toFixed(2)}`}>
  {formatLargeNumber(safeMarketValue)}
</p >
              {displayPercent !== 0 && (
  <p className={`text-[9px] font-bold ${profitLossSmallColor}`}>
    {displayPercentSign}{isNaN(displayPercent) ? '0.00' : displayPercent.toFixed(2)}%
  </p >
)}
            </div>
          </div>

          {/* 仅非简单资产显示份额 */}
          {!isSimpleAsset && (
            <div className="flex justify-end mt-0.5">
              <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate" title={`${typeof asset.holdings === 'number' ? asset.holdings.toFixed(2) : '0.00'}份`}>
  {typeof asset.holdings === 'number' ? asset.holdings.toFixed(2) : '0.00'}份
</p >
            </div>
          )}

          {/* 仅非简单资产显示市价/成本行 */}
          {!isSimpleAsset && (
            <div className="mt-2 border-t border-gray-100 dark:border-gray-800 pt-2 flex justify-between items-center">
              <div className="flex items-center gap-1 min-w-0 flex-1">
                <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 flex-shrink-0">
                  {asset.costPrice ? '市价/成本' : '市价'}
                </p >
                {asset.costPrice ? (
                  <p className={`text-xs font-bold truncate ${profitLossColor}`} title={`${Number(asset.price).toFixed(2)} / ${Number(asset.costPrice).toFixed(2)}`}>
                    {Number(asset.price).toFixed(2)} / {Number(asset.costPrice).toFixed(2)}
                  </p >
                ) : (
                  <p className="text-xs font-bold truncate text-gray-900 dark:text-gray-100" title={`${Number(asset.price).toFixed(2)}`}>
                    {Number(asset.price).toFixed(2)}
                  </p >
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteAsset(asset.symbol);
                }}
                className="text-[10px] font-bold text-red-500 dark:text-red-400 hover:underline flex-shrink-0 ml-1"
              >
                删除
              </button>
            </div>
          )}

          {/* 简单资产（现金、不动产、汽车）只保留删除按钮，无市价/成本行 */}
          {isSimpleAsset && (
            <div className="mt-2 border-t border-gray-100 dark:border-gray-800 pt-2 flex justify-end">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteAsset(asset.symbol);
                }}
                className="text-[10px] font-bold text-red-500 dark:text-red-400 hover:underline"
              >
                删除
              </button>
            </div>
          )}
        </div>
      </div>
    );
  })
) : (
  // 空状态保持不变
  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 col-span-full">
    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-3">目前没有任何资产</h2>
    <p className="text-gray-500 dark:text-gray-400 mb-2 max-w-md">
      点击右下方加号开始追踪您的投资
    </p >
  </div>
)}
      </div>

      {/* 菜单浮层 */}
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
                    <Banknote size={24} />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-blue-900 dark:text-blue-300 text-lg">现金</p>
                    <p className="text-xs text-blue-600/70 dark:text-blue-400/70 font-medium">现金、活期存款</p>
                  </div>
                </div>
                <ChevronRight className="text-blue-300 dark:text-blue-500 group-active:translate-x-1 transition-transform" />
              </button>
              <button
  onClick={() => {
    setSelectedAssetType('custom_asset');
    setView('search');
    setSearchQuery('');
    setFoundAsset(null);
    setSearchError(null);
    setHoldings("");
    setPurchaseDate("");
    setCostPrice("");
    setCustomAssetType('');
    setCustomAssetName('');
    setCustomAssetAmount('');
    setCustomAssetOrderDate('');
    setCustomAssetNotes('');
    setCustomAssetIncludeInChart(true);
    setBrandsList([]);
    setSelectedBrandId('');
    setSelectedBrandName('');
  }}
  className="flex items-center justify-between p-5 bg-blue-50 dark:bg-blue-900/30 rounded-[28px] border border-blue-100 dark:border-blue-800 group active:scale-[0.98] transition-all"
>
  <div className="flex items-center gap-4">
    <div className="bg-purple-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/20">
      <Activity size={24} />
    </div>
    <div className="text-left">
      <p className="font-bold text-blue-900 dark:text-blue-300 text-lg">自定义</p >
      <p className="text-xs text-blue-600/70 dark:text-blue-400/70 font-medium">负债、应收款、收藏品、其他</p >
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

    {/* 独立浮层：品牌选择、图标选择、资产详情 */}
    {showBrandSelector && (
      <BrandSelector
        brands={brandsList}
        onSelect={(brand) => {
          setSelectedBrandId(brand.id);
          setSelectedBrandName(brand.name);
          setShowBrandSelector(false);
        }}
        onClose={() => setShowBrandSelector(false)}
      />
    )}
    {showIconPage && (
  <IconSelector
    groups={iconGroups}
    onSelect={(iconFile) => setSelectedIcon(iconFile)}
    onClose={() => setShowIconPage(false)}
  />
)}
    <AssetDetailDrawer
      symbol={selectedAssetSymbol}
      isOpen={isDetailOpen}
      onClose={closeAssetDetail}
    />
  </>
);
}