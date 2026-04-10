// components/AssetAddFlow.tsx
"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Hotel, ChevronRight, Search, Loader2, AlertCircle, ArrowLeft, 
  Activity, CarFront, ChevronDown, Banknote, Receipt, ReceiptText, 
} from 'lucide-react';
import { FaBitcoin, FaCar, } from "react-icons/fa";
import { RiStockFill, RiFundsFill } from "react-icons/ri";
import { AiFillGold, AiOutlineStock, AiOutlineFund, } from "react-icons/ai";
import { MdRealEstateAgent } from "react-icons/md";
import { IoMdCash } from "react-icons/io";
import { BsCurrencyBitcoin, BsLightningChargeFill } from "react-icons/bs";
import { GiMetalBar } from "react-icons/gi";
import { IoReceipt } from "react-icons/io5";

import { AShareNameMap } from '@/src/constants/shareNames';
import { Asset } from '@/src/constants/types';
import { getCurrentUserId } from '@/src/utils/assetStorage';
import { eventBus } from '@/src/utils/eventBus';
import { cacheLogo } from '@/src/utils/logoCache';
import { useTheme } from '@/app/ThemeProvider';
import BrandSelector from '@/app/portfolio/BrandSelector';
import IconSelector from '@/app/portfolio/IconSelector';
import { useCurrency } from '@/src/services/currency';

// 类型定义
interface CarBrand {
  id: string;
  name: string;
  firstLetter: string;
  logoUrl?: string;
}

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

interface AssetAddFlowProps {
  onAssetAdded: () => void;  // 添加资产成功后的回调（刷新资产列表）
  currencySymbolMap: Record<string, string>;
}

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
  { id: '爱驰', name: '爱驰', firstLetter: 'A', logoUrl: '/images/car_logos/爱驰.png'},
  { id: '安徽猎豹', name: '安徽猎豹', firstLetter: 'A', logoUrl: '/images/car_logos/安徽猎豹.png'},
  { id: '安凯客车', name: '安凯客车', firstLetter: 'A', logoUrl: '/images/car_logos/安凯客车.png'},
  { id: 'aria', name: 'aria', firstLetter: 'A', logoUrl: '/images/car_logos/aria.png'},
  { id: 'ARIEL', name: 'ARIEL', firstLetter: 'A', logoUrl: '/images/car_logos/ariel.png'},
  { id: 'ASPARK', name: 'ASPARK', firstLetter: 'A', logoUrl: '/images/car_logos/aspark.png'},
  { id: 'ATLIS', name: 'ATLIS', firstLetter: 'A', logoUrl: '/images/car_logos/atlis.png'},
  { id: 'ats', name: 'ats', firstLetter: 'A', logoUrl: '/images/car_logos/ats.png'},
  { id: 'AURUS', name: 'AURUS', firstLetter: 'A', logoUrl: '/images/car_logos/aurus.png'},
  { id: 'AUXUN傲旋', name: 'AUXUN傲旋', firstLetter: 'A', logoUrl: '/images/car_logos/auxun傲旋.png'},
  { id: 'AVIAR', name: 'AVIAR', firstLetter: 'A', logoUrl: '/images/car_logos/aviar.png'},
  { id: 'AZNOM', name: 'AZNOM', firstLetter: 'A', logoUrl: '/images/car_logos/aznom.png'},


  // B
  { id: 'BMW', name: 'BMW', firstLetter: 'B', logoUrl: '/images/car_logos/BMW.png' },
  { id: 'BUGATTI', name: 'BUGATTI', firstLetter: 'B', logoUrl: '/images/car_logos/布加迪.png'},
  { id: 'Porsche', name: 'Porsche', firstLetter:'P', logoUrl:'/images/car_logos/Porsche.png' },
  { id: 'Bentley', name: 'Bentley', firstLetter:'B', logoUrl:'/images/car_logos/宾利.png' },
  { id: 'BUFITE', name: 'BUFITE', firstLetter:'B', logoUrl:'/images/car_logos/巴菲特汽车.png' },
  { id: '百度apollo', name: '百度apollo', firstLetter:'B', logoUrl:'/images/car_logos/百度apollo.png' },
  { id: '百智新能源', name: '百智新能源', firstLetter:'B', logoUrl:'/images/car_logos/百智新能源.png' },
  { id: '佰斯威', name: '佰斯威', firstLetter:'B', logoUrl:'/images/car_logos/佰斯威.png' },
  { id: '拜腾', name: '拜腾', firstLetter:'B', logoUrl:'/images/car_logos/拜腾.png' },
  { id: '宝骏', name: '宝骏', firstLetter:'B', logoUrl:'/images/car_logos/宝骏.png' },
  { id: '宝骐汽车', name: '宝骐汽车', firstLetter:'B', logoUrl:'/images/car_logos/宝骐汽车.png' },
  { id: '宝腾', name: '宝腾', firstLetter:'B', logoUrl:'/images/car_logos/宝腾.png' },
  { id: '宝沃', name: '宝沃', firstLetter:'B', logoUrl:'/images/car_logos/宝沃.png' },
  { id: 'Bufori', name: 'Bufori', firstLetter:'B', logoUrl:'/images/car_logos/保斐利.png' },
  { id: '北方房车', name: '北方房车', firstLetter:'B', logoUrl:'/images/car_logos/北方房车.png' },
  { id: '北京汽车', name: '北京汽车', firstLetter:'B', logoUrl:'/images/car_logos/北京汽车.png' },
  { id: 'BAW', name: 'BAW', firstLetter:'B', logoUrl:'/images/car_logos/北京汽车制造厂.png' },
  
  

  // H
  { id: 'HONDA', name: 'HONDA', firstLetter: 'H', logoUrl: '/images/car_logos/HONDA.png'},

  // K
  { id: 'Chrysler', name: 'Chrysler', firstLetter:'K', logoUrl:'/images/car_logos/克莱斯勒.png' },

  // M
  { id: 'mercedes-benz', name: 'Mercedes-Benz', firstLetter: 'M', logoUrl: '/images/car_logos/Mercedes-Benz.png' },
  { id: 'Mercedes Maybach', name: 'Mercedes Maybach', firstLetter: 'M', logoUrl: '/images/car_logos/Maybach.png' },
  { id: 'Mclaren', name: ' Mclaren', firstLetter: 'M', logoUrl: '/images/car_logos/Mclaren.png' },
  { id: 'MASERATI', name: 'MASERATI', firstLetter: 'M', logoUrl: '/images/car_logos/MASERATI.png' },
  { id: 'MANSORY', name: 'MANSORY', firstLetter: 'M', logoUrl: '/images/car_logos/MANSORY.png' },
  
  // L
  { id: 'Lamborghini', name: 'Lamborghini', firstLetter:' L', logoUrl:'/images/car_logos/Lamborghini.png' },
  { id: '理想', name: '理想', firstLetter:'L', logoUrl:'/images/car_logos/理想.png'},
  { id: 'Land Rover', name: 'Land Rover', firstLetter:'L', logoUrl:'/images/car_logos/路虎.png'},
  
  // R
  { id: 'Rolls Royce', name: 'Rolls Royce', firstLetter:'R', logoUrl:'/images/car_logos/劳斯莱斯.png' },

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

const networkIcons = [
  { key: 'alipay', name: '支付宝', lightFile: 'alipay_light.png', darkFile: 'alipay_dark.png' },
  { key: 'wechat', name: '微信', lightFile: 'wechat_light.png', darkFile: 'wechat_dark.png' },
  { key: 'applepay', name: 'Apple', lightFile: 'applepay_light.png', darkFile: 'applepay_dark.png' },
  { key: 'paypal', name: 'PayPal', lightFile: 'paypal_light.png', darkFile: 'paypal_dark.png' },
  { key: 'e-CNY', name: 'e-CNY', lightFile: 'e-CNY_light.png', darkFile: 'e-CNY_dark.png' },
];

const bankIcons = [
  { key: 'icbc', name: 'ICBC', lightFile: 'icbc_light.png', darkFile: 'icbc_dark.png' },
  { key: 'abc', name: 'ABC', lightFile: 'abc_light.png', darkFile: 'abc_dark.png' },
  { key: 'boc', name: 'BOC', lightFile: 'boc_light.png', darkFile: 'boc_dark.png' },
  { key: 'ccb', name: 'CCB', lightFile: 'ccb_light.png', darkFile: 'ccb_dark.png' },
  { key: 'cmb', name: 'CMB', lightFile: 'cmb_light.png', darkFile: 'cmb_dark.png' },
  { key: 'pab', name: 'PAB', lightFile: 'pab_light.png', darkFile: 'pab_dark.png' },
  { key: 'bob', name: 'BOB', lightFile: 'bob_light.png', darkFile: 'bob_dark.png' },
  { key: 'bod', name: 'BOD', lightFile: 'bod_light.png', darkFile: 'bod_dark.png' },
  { key: 'ceb', name: 'CEB', lightFile: 'ceb_light.png', darkFile: 'ceb_dark.png' },
];

const allIcons = [...networkIcons, ...bankIcons];
const iconGroups = [
  { title: '网络账户', icons: networkIcons },
  { title: '银行帐户', icons: bankIcons },
];

export default function AssetAddFlow({ onAssetAdded, currencySymbolMap }: AssetAddFlowProps) {
  const { theme } = useTheme();
  const { currency } = useCurrency();  // 获取当前货币代码

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
  const [customAssetType, setCustomAssetType] = useState<string>('');
  const [customAssetName, setCustomAssetName] = useState<string>('');
  const [customAssetAmount, setCustomAssetAmount] = useState<string>('');
  const [customAssetOrderDate, setCustomAssetOrderDate] = useState<string>('');
  const [customAssetNotes, setCustomAssetNotes] = useState<string>('');
  const [customAssetIncludeInChart, setCustomAssetIncludeInChart] = useState<boolean>(true);
  const [brandsList, setBrandsList] = useState<any[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const [selectedBrandName, setSelectedBrandName] = useState<string>('');
  const [loadingCarData, setLoadingCarData] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);

  // 加载汽车logo文件名（用于验证）
  useEffect(() => {
    fetch('/car_logo_filenames.json')
      .then(res => res.json())
      .then(setImageFileNames)
      .catch(err => console.warn('无法加载文件名列表', err));
  }, []);

  // 辅助函数：规范化A股代码
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

  // 搜索触发
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
        const isAStock = /^\d{6}$/.test(cleanSymbol) && 
                         (data.symbol.includes('.SS') || data.symbol.includes('.SZ'));
        if (isAStock) {
          logoUrl = `https://static.futunn.com/project/stock_company_logo/${cleanSymbol}.png`;
        } else if (cleanSymbol && process.env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID) {
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
  }, [searchQuery]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setIsSearching(true);
      triggerSearch();
    }
  };

  // 计算市值
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

  // 添加资产（股票、基金、加密货币、贵金属）
const handleAddAsset = async () => {
  if (!foundAsset || !holdings) return;
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

  const userId = getCurrentUserId();
  if (!userId) {
    alert('请先登录');
    return;
  }

  try {
    // 1. 保存资产
    const res = await fetch('/api/asset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
      body: JSON.stringify(newAsset),
    });
    if (!res.ok) {
      alert('添加资产失败');
      return;
    }

    // 2. 插入买入交易记录（仅当用户填写了买入价或买入日期时）
    const transactionData = {
      assetSymbol: foundAsset.symbol,
      transactionType: 'buy',
      quantity: holdingsNum,
      price: costPrice ? parseFloat(costPrice) : foundAsset.price,  // 优先使用买入价
      transactionDate: purchaseDate || new Date().toISOString().split('T')[0],
      currency: foundAsset.currency,
      category: 'buy',
      note: '',
    };

    const txRes = await fetch('/api/transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
      body: JSON.stringify(transactionData),
    });

    if (!txRes.ok) {
      console.warn('交易记录添加失败，但资产已保存');
    }

    // 缓存 logo
    if (foundAsset.logoUrl) {
      cacheLogo(foundAsset.symbol, foundAsset.logoUrl).catch(console.warn);
    }

    // 拉取历史数据（股票/ETF）
    if (newAsset.type === 'stock' || newAsset.type === 'etf') {
      fetch('/api/history/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset: { type: newAsset.type, symbol: newAsset.symbol } })
      }).catch(err => console.error(`拉取 ${newAsset.symbol} 历史数据失败:`, err));
    }

    eventBus.emit('assetsUpdated');
    onAssetAdded();
    resetForm();
    setShowMenu(false);
  } catch (err) {
    console.error('添加资产失败', err);
    alert('添加失败');
  }
};

  // 添加汽车
  const handleAddCarAsset = async () => {
    if (!selectedBrandId) {
      alert('请选择品牌');
      return;
    }
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

    const carName = `${selectedBrandName} ${seriesInput} ${modelInput}`.trim();
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

    const userId = getCurrentUserId();
    if (!userId) {
      alert('请先登录');
      return;
    }

    try {
      const res = await fetch('/api/asset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify(newAsset),
      });
      if (res.ok) {
        eventBus.emit('assetsUpdated');
        onAssetAdded();
        resetForm();
        setShowMenu(false);
      } else {
        console.error('添加失败');
      }
    } catch (err) {
      console.error('添加汽车资产失败', err);
    }
  };

  // 添加不动产
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

    const userId = getCurrentUserId();
    if (!userId) {
      alert('请先登录');
      return;
    }

    try {
      const res = await fetch('/api/asset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify(newAsset),
      });
      if (res.ok) {
        eventBus.emit('assetsUpdated');
        onAssetAdded();
        resetForm();
        setShowMenu(false);
      } else {
        console.error('添加失败');
      }
    } catch (err) {
      console.error('添加房产资产失败', err);
    }
  };

  // 添加现金
const handleAddCashAsset = async () => {
  const name = cashName.trim() || '现金';
  const amount = parseFloat(holdings) || 0;
  if (amount <= 0) {
    alert('请输入有效的金额');
    return;
  }

  // selectedIcon 已经是 key（如 'alipay'）
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
    logoUrl: selectedIcon || undefined,   // 存储 key
  };

    const userId = getCurrentUserId();
    if (!userId) {
      alert('请先登录');
      return;
    }

    try {
      const res = await fetch('/api/asset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify(newAsset),
      });
      if (res.ok) {
        eventBus.emit('assetsUpdated');
        onAssetAdded();
        resetForm();
        setShowMenu(false);
      } else {
        console.error('添加失败');
      }
    } catch (err) {
      console.error('添加现金资产失败', err);
    }
  };

  // 添加自定义资产
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

    const userId = getCurrentUserId();
    if (!userId) {
      alert('请先登录');
      return;
    }

    try {
      const res = await fetch('/api/asset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify(newAsset),
      });
      if (res.ok) {
        eventBus.emit('assetsUpdated');
        onAssetAdded();
        resetForm();
        setShowMenu(false);
      } else {
        console.error('添加失败');
      }
    } catch (err) {
      console.error('添加自定义资产失败', err);
    }
  };

  // 重置表单状态
  const resetForm = () => {
    setSelectedBrandId('');
    setSelectedBrandName('');
    setHoldings("");
    setPurchaseDate("");
    setCostPrice("");
    setFoundAsset(null);
    setSearchQuery('');
    setRealEstateName('');
    setRealEstateIncludeInChart(true);
    setRealEstateNotes('');
    setRealEstateQuantity('1');
    setCashName('');
    setSelectedIcon('');
    setCustomAssetType('');
    setCustomAssetName('');
    setCustomAssetAmount('');
    setCustomAssetOrderDate('');
    setCustomAssetNotes('');
    setCustomAssetIncludeInChart(true);
    setView('categories');
    setSelectedMainCategory(null);
    setSelectedAssetType(null);
    setBrandsList([]);
  };

  const handleMainCategoryClick = (category: MainCategory) => {
    if (category === 'custom') {
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
    setBrandsList([]);
    setSelectedBrandId('');
    setSelectedBrandName('');
    if (type === 'car') {
      setBrandsList(carBrands);
      setSelectedBrandId('');
      setSelectedBrandName('');
      setLoadingCarData(false);
    }
    if (type === 'real_estate') {
      setRealEstateName('');
      setRealEstateIncludeInChart(true);
      setRealEstateNotes('');
      setRealEstateQuantity('1');
    }
    if (type === 'custom') {
      setCashName('');
    }
  };

  const handleBack = () => {
    if (view === 'subCategories') {
      setView('categories');
      setSelectedMainCategory(null);
    } else if (view === 'search') {
      if (selectedAssetType === 'custom') {
        setView('categories');
        setSelectedMainCategory(null);
        setSelectedAssetType(null);
        setCashName('');
        setSelectedIcon('');
      } else if (selectedAssetType === 'custom_asset') {
        setView('categories');
        setSelectedMainCategory(null);
        setSelectedAssetType(null);
        setCustomAssetType('');
        setCustomAssetName('');
        setCustomAssetAmount('');
        setCustomAssetOrderDate('');
        setCustomAssetNotes('');
        setCustomAssetIncludeInChart(true);
      } else {
        setView('subCategories');
        setSelectedAssetType(null);
      }
      setFoundAsset(null);
      setSearchQuery('');
      setSearchError(null);
      setHoldings("");
      setPurchaseDate("");
      setCostPrice("");
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
        setBrandsList([]);
        setSelectedBrandId('');
        setSelectedBrandName('');
      }
      touchStartY.current = null;
    }
  };

  // 渲染子分类（流动资产/固定资产等）
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
            <button onClick={() => handleAssetTypeClick('stock')} className="flex items-center justify-between p-5 bg-blue-50 dark:bg-blue-900/30 rounded-[28px] border border-blue-100 dark:border-blue-800 group active:scale-[0.98] transition-all">
              <div className="flex items-center gap-4">
                <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/20"><RiStockFill size={24} /></div>
                <div className="text-left"><p className="font-bold text-blue-900 dark:text-blue-300 text-lg">股票</p><p className="text-xs text-blue-600/70 dark:text-blue-400/70 font-medium">美股、A股、港股、ETF</p></div>
              </div>
              <ChevronRight className="text-blue-300 dark:text-blue-500 group-active:translate-x-1 transition-transform" />
            </button>
            <button onClick={() => handleAssetTypeClick('fund')} className="flex items-center justify-between p-5 bg-blue-50 dark:bg-blue-900/30 rounded-[28px] border border-blue-100 dark:border-blue-800 group active:scale-[0.98] transition-all">
              <div className="flex items-center gap-4"><div className="bg-blue-600 p-3 rounded-2xl text-white"><RiFundsFill size={24} /></div><div className="text-left"><p className="font-bold text-blue-900 dark:text-blue-300 text-lg">基金</p><p className="text-xs text-blue-600/70 dark:text-blue-400/70 font-medium">场外基金、指数基金</p></div></div>
              <ChevronRight className="text-blue-300 dark:text-blue-500 group-active:translate-x-1 transition-transform" />
            </button>
            <button onClick={() => handleAssetTypeClick('crypto')} className="flex items-center justify-between p-5 bg-blue-50 dark:bg-blue-900/30 rounded-[28px] border border-blue-100 dark:border-blue-800 group active:scale-[0.98] transition-all">
              <div className="flex items-center gap-4"><div className="bg-blue-600 p-3 rounded-2xl text-white"><FaBitcoin size={24} /></div><div className="text-left"><p className="font-bold text-blue-900 dark:text-blue-300 text-lg">加密货币</p><p className="text-xs text-blue-600/70 dark:text-blue-400/70 font-medium">BTC、ETH、主流币</p></div></div>
              <ChevronRight className="text-blue-300 dark:text-blue-500 group-active:translate-x-1 transition-transform" />
            </button>
            <button onClick={() => handleAssetTypeClick('metal')} className="flex items-center justify-between p-5 bg-blue-50 dark:bg-blue-900/30 rounded-[28px] border border-blue-100 dark:border-blue-800 group active:scale-[0.98] transition-all">
              <div className="flex items-center gap-4"><div className="bg-blue-600 p-3 rounded-2xl text-white"><AiFillGold size={24} /></div><div className="text-left"><p className="font-bold text-blue-900 dark:text-blue-300 text-lg">贵金属</p><p className="text-xs text-blue-600/70 dark:text-blue-400/70 font-medium">黄金、白银 (Au999, XAU)</p></div></div>
              <ChevronRight className="text-blue-300 dark:text-blue-500 group-active:translate-x-1 transition-transform" />
            </button>
          </>
        )}
        {selectedMainCategory === 'fixed' && (
          <>
            <button onClick={() => handleAssetTypeClick('real_estate')} className="flex items-center justify-between p-5 bg-blue-50 dark:bg-blue-900/30 rounded-[28px] border border-blue-100 dark:border-blue-800 group active:scale-[0.98] transition-all">
              <div className="flex items-center gap-4"><div className="bg-yellow-600 p-3 rounded-2xl text-white"><MdRealEstateAgent size={24} /></div><div className="text-left"><p className="font-bold text-blue-900 dark:text-blue-300 text-lg">不动产</p><p className="text-xs text-blue-600/70 dark:text-blue-400/70 font-medium">住宅、商铺</p></div></div>
              <ChevronRight className="text-blue-300 dark:text-blue-500 group-active:translate-x-1 transition-transform" />
            </button>
            <button onClick={() => handleAssetTypeClick('car')} className="flex items-center justify-between p-5 bg-blue-50 dark:bg-blue-900/30 rounded-[28px] border border-blue-100 dark:border-blue-800 group active:scale-[0.98] transition-all">
              <div className="flex items-center gap-4"><div className="bg-yellow-600 p-3 rounded-2xl text-white"><FaCar size={24} /></div><div className="text-left"><p className="font-bold text-blue-900 dark:text-blue-300 text-lg">汽车</p><p className="text-xs text-blue-600/70 dark:text-blue-400/70 font-medium">品牌选择 + 手动输入</p></div></div>
              <ChevronRight className="text-blue-300 dark:text-blue-500 group-active:translate-x-1 transition-transform" />
            </button>
          </>
        )}
        {selectedMainCategory === 'custom' && (
          <button onClick={() => handleAssetTypeClick('custom')} className="flex items-center justify-between p-5 bg-blue-50 dark:bg-blue-900/30 rounded-[28px] border border-blue-100 dark:border-blue-800 group active:scale-[0.98] transition-all">
            <div className="flex items-center gap-4"><div className="bg-green-600 p-3 rounded-2xl text-white"><IoMdCash size={24} /></div><div className="text-left"><p className="font-bold text-blue-900 dark:text-blue-300 text-lg">现金</p><p className="text-xs text-blue-600/70 dark:text-blue-400/70 font-medium">现金、活期存款</p></div></div>
            <ChevronRight className="text-blue-300 dark:text-blue-500 group-active:translate-x-1 transition-transform" />
          </button>
        )}
      </div>
    </div>
  );

  // 汽车表单
  const renderCarForm = () => {
    const selectedBrand = selectedBrandId ? brandsList.find(b => b.id === selectedBrandId) : null;
    return (
      <div className="bg-white dark:bg-[#0a0a0a] border-2 border-blue-500 p-6 rounded-[32px] shadow-xl shadow-blue-50 dark:shadow-blue-900/20 animate-in zoom-in-95 duration-300">
        <div className="flex flex-col gap-2 mb-6">
          <div className="flex items-center gap-2"><span className="bg-yellow-600 text-[10px] text-white px-2 py-0.5 rounded-md font-bold uppercase">汽车</span></div>
          {loadingCarData && <div className="flex justify-center py-4"><Loader2 className="animate-spin text-blue-600 dark:text-blue-400" size={24} /></div>}
          <div className="space-y-4">
            <div><label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">品牌</label>
              <button onClick={() => setShowBrandSelector(true)} className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-left text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-blue-500 flex items-center justify-between">
                <div className="flex items-center gap-2 truncate">{selectedBrand?.logoUrl && <img src={selectedBrand.logoUrl} alt={selectedBrandName} className="w-6 h-6 object-contain flex-shrink-0" onError={(e) => (e.currentTarget.style.display = 'none')} />}<span className="truncate">{selectedBrandName || '选择品牌'}</span></div>
                <ChevronDown size={20} className="text-gray-500 flex-shrink-0" />
              </button>
            </div>
            <div><label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">车系</label><input id="car-series" type="text" placeholder="例如 A4L, 3系, Model Y" className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-gray-900 dark:text-gray-100 outline-none" /></div>
            <div><label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">车型</label><input id="car-model" type="text" placeholder="例如 2023款 45 TFSI, 330i, 标准续航版" className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-gray-900 dark:text-gray-100 outline-none" /></div>
          </div>
        </div>
        <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
          <div><label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">持有数量</label><input type="number" placeholder="1" className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-gray-900 dark:text-gray-100 outline-none" value={holdings} onChange={(e) => setHoldings(e.target.value)} step="1" min="0" /></div>
          <div><label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">买入日期</label><input type="date" className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-blue-500 appearance-none" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} /></div>
          <div><label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">买入价值</label><input type="number" placeholder="20.00" className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-gray-900 dark:text-gray-100 outline-none" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} step="0.01" /></div>
          <button onClick={handleAddCarAsset} disabled={!selectedBrandId || !holdings} className="w-full bg-blue-600 text-white font-black py-4 rounded-[20px] shadow-lg shadow-blue-200 dark:shadow-blue-900/20 active:scale-[0.98] transition-all disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed">确认添加汽车</button>
        </div>
        {showBrandSelector && <BrandSelector brands={brandsList} onSelect={(brand) => { setSelectedBrandId(brand.id); setSelectedBrandName(brand.name); setShowBrandSelector(false); }} onClose={() => setShowBrandSelector(false)} />}
      </div>
    );
  };

  // 不动产表单
  const renderRealEstateForm = () => (
    <div className="bg-white dark:bg-[#0a0a0a] border-2 border-blue-500 p-6 rounded-[32px] shadow-xl shadow-blue-50 dark:shadow-blue-900/20 animate-in zoom-in-95 duration-300">
      <div className="flex flex-col gap-2 mb-6"><div className="flex items-center gap-2"><span className="bg-yellow-600 text-[10px] text-white px-2 py-0.5 rounded-md font-bold uppercase">不动产</span></div>
      <div className="space-y-4">
        <div><label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">自定名称</label><input type="text" placeholder="默认为不动产" className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-gray-900 dark:text-gray-100 outline-none" value={realEstateName} onChange={(e) => setRealEstateName(e.target.value)} /></div>
        <div><label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">买入日期</label><input type="date" className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-blue-500 appearance-none" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} /></div>
        <div><label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">持有数量</label><input type="number" placeholder="1" className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-gray-900 dark:text-gray-100 outline-none" value={realEstateQuantity} onChange={(e) => setRealEstateQuantity(e.target.value)} step="1" min="1" /></div>
        <div><label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">持有价值</label><input type="number" placeholder="0.00" className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-gray-900 dark:text-gray-100 outline-none" value={holdings} onChange={(e) => setHoldings(e.target.value)} step="0.01" min="0" /></div>
        <div className="flex items-center justify-between"><label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">计入图表</label><button onClick={() => setRealEstateIncludeInChart(!realEstateIncludeInChart)} className={`w-12 h-6 rounded-full transition-colors ${realEstateIncludeInChart ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'}`}><div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${realEstateIncludeInChart ? 'translate-x-6' : 'translate-x-1'}`} /></button></div>
        <div><label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">备注</label><input type="text" placeholder="可选" className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-gray-900 dark:text-gray-100 outline-none" value={realEstateNotes} onChange={(e) => setRealEstateNotes(e.target.value)} /></div>
      </div></div>
      <div className="pt-4 border-t border-gray-100 dark:border-gray-800"><button onClick={handleAddRealEstateAsset} disabled={!holdings || parseFloat(holdings) <= 0 || !realEstateQuantity || parseFloat(realEstateQuantity) <= 0} className="w-full bg-blue-600 text-white font-black py-4 rounded-[20px] shadow-lg shadow-blue-200 dark:shadow-blue-900/20 active:scale-[0.98] transition-all disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed">确认添加</button></div>
    </div>
  );


// 现金表单
const renderCashForm = () => {
  // 根据 selectedIcon (key) 查找图标数据
  const selectedIconData = allIcons.find(icon => icon.key === selectedIcon);
  
  // 根据主题决定显示的图片文件名
  const displayIconFile = selectedIconData 
    ? (theme === 'dark' ? selectedIconData.darkFile : selectedIconData.lightFile)
    : null;

  return (
    <div className="bg-white dark:bg-[#0a0a0a] border-2 border-blue-500 p-6 rounded-[32px] shadow-xl shadow-blue-50 dark:shadow-blue-900/20 animate-in zoom-in-95 duration-300">
      <div className="flex flex-col gap-2 mb-6">
        <div className="flex items-center gap-2">
          <span className="bg-green-600 text-[10px] text-white px-2 py-0.5 rounded-md font-bold uppercase">现金</span>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">名称（可选）</label>
            <input type="text" placeholder="默认为现金" className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-gray-900 dark:text-gray-100 outline-none" value={cashName} onChange={(e) => setCashName(e.target.value)} />
          </div>
          <div>
            <label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">选择图标（可选）</label>
            <button onClick={() => setShowIconPage(true)} className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-left text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-blue-500 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {selectedIconData && displayIconFile ? (
                  <img 
                    src={`/icons/payment/${displayIconFile}`} 
                    alt="" 
                    className="w-6 h-6 object-contain rounded-lg" 
                    onError={(e) => (e.currentTarget.style.display = 'none')} 
                  />
                ) : (
                  <Banknote size={20} className="text-gray-500" />
                )}
                <span className="truncate">
                  {selectedIconData ? selectedIconData.name : '点击选择图标'}
                </span>
              </div>
              <ChevronDown size={20} className="text-gray-500 flex-shrink-0" />
            </button>
          </div>
          <div>
            <label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">金额</label>
            <input type="number" placeholder="0.00" className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-gray-900 dark:text-gray-100 outline-none" value={holdings} onChange={(e) => setHoldings(e.target.value)} step="0.01" min="0" />
          </div>
          <div>
            <label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">存入日期</label>
            <input type="date" className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-gray-900 dark:text-gray-100 outline-none appearance-none" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
          </div>
        </div>
      </div>
      <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
        <button onClick={handleAddCashAsset} disabled={!holdings || parseFloat(holdings) <= 0} className="w-full bg-blue-600 text-white font-black py-4 rounded-[20px] shadow-lg shadow-blue-200 dark:shadow-blue-900/20 active:scale-[0.98] transition-all disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed">确认添加</button>
      </div>
    </div>
  );
};
  // 自定义资产表单
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
      case 'stock': return <AiOutlineStock size={size} className="text-blue-600" />;
      case 'fund': return <AiOutlineFund size={size} className="text-green-600" />;
      case 'crypto': return <BsCurrencyBitcoin size={size} className="text-purple-600" />;
      case 'metal': return <GiMetalBar size={size} className="text-yellow-600" />;
      case 'real_estate': return <Hotel size={size} className="text-orange-600" />;
      case 'car': return <CarFront size={size} className="text-cyan-600" />;
      case 'custom': return <IoMdCash size={size} className="text-green-600" />;
      case 'receivable': return <IoReceipt size={size} className="text-indigo-600" />;
      case 'custom_asset': return <Activity size={size} className="text-purple-600" />;
      case 'liability': return <ReceiptText size={size} className="text-red-600" />;
      default: return null;
    }
  };
  const renderCustomAssetForm = () => (
    <div className="bg-white dark:bg-[#0a0a0a] border-2 border-blue-500 p-6 rounded-[32px] shadow-xl shadow-blue-50 dark:shadow-blue-900/20 animate-in zoom-in-95 duration-300">
      <div className="flex flex-col gap-2 mb-6"><div className="flex items-center gap-2"><span className="bg-purple-600 text-[10px] text-white px-2 py-0.5 rounded-md font-bold uppercase">自定义</span></div>
      <div className="space-y-4">
        <div><label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">资产类型</label><div className="flex items-center gap-3 relative"><div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center flex-shrink-0">{customAssetType ? getAssetTypeIcon(customAssetType, 28) : <Activity size={28} className="text-gray-400" />}</div><select value={customAssetType} onChange={(e) => setCustomAssetType(e.target.value)} className="flex-1 bg-gray-50 dark:bg-[#1a1a1a] pl-4 pr-10 py-4 rounded-2xl font-bold text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-blue-500 appearance-none">{assetTypeOptions.map(option => (<option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>))}</select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={20} /></div></div>
        <div><label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">资产名称</label><input type="text" placeholder="自定义资产名称" className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-gray-900 dark:text-gray-100 outline-none" value={customAssetName} onChange={(e) => setCustomAssetName(e.target.value)} /></div>
        <div><label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">金额</label><input type="number" placeholder="0.00" className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-gray-900 dark:text-gray-100 outline-none" value={customAssetAmount} onChange={(e) => setCustomAssetAmount(e.target.value)} step="0.01" min="0" /></div>
        <div><label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">订单时间</label><input type="date" className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-gray-900 dark:text-gray-100 outline-none appearance-none" value={customAssetOrderDate} onChange={(e) => setCustomAssetOrderDate(e.target.value)} /></div>
        <div><label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">备注</label><input type="text" placeholder="可选" className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-gray-900 dark:text-gray-100 outline-none" value={customAssetNotes} onChange={(e) => setCustomAssetNotes(e.target.value)} /></div>
        <div className="flex items-center justify-between"><label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">计入图表</label><button onClick={() => setCustomAssetIncludeInChart(!customAssetIncludeInChart)} className={`w-12 h-6 rounded-full transition-colors ${customAssetIncludeInChart ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'}`}><div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${customAssetIncludeInChart ? 'translate-x-6' : 'translate-x-1'}`} /></button></div>
      </div></div>
      <div className="pt-4 border-t border-gray-100 dark:border-gray-800"><button onClick={handleAddCustomAsset} disabled={!customAssetName.trim() || !customAssetAmount || parseFloat(customAssetAmount) <= 0} className="w-full bg-blue-600 text-white font-black py-4 rounded-[20px] shadow-lg shadow-blue-200 dark:shadow-blue-900/20 active:scale-[0.98] transition-all disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed">确认添加</button></div>
    </div>
  );

  // 搜索渲染（根据 selectedAssetType 展示不同表单）
  const renderSearch = () => {
    if (selectedAssetType === 'car') {
      return (
        <div ref={scrollContainerRef} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} className="flex flex-col animate-in fade-in slide-in-from-right duration-300 max-h-[70vh] overflow-y-auto">
          <div className="flex items-center gap-4 mb-8"><button onClick={handleBack} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-500 dark:text-gray-300"><ArrowLeft size={20} /></button><h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">添加汽车资产</h3></div>
          <div className="min-h-[200px]">{renderCarForm()}</div>
        </div>
      );
    }
    if (selectedAssetType === 'metal') {
      return (
        <div ref={scrollContainerRef} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} className="flex flex-col animate-in fade-in slide-in-from-right duration-300 max-h-[70vh] overflow-y-auto overflow-x-hidden px-1">
          <div className="flex items-center gap-4 mb-8"><button onClick={handleBack} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-500 dark:text-gray-300"><ArrowLeft size={20} /></button><h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">添加贵金属</h3></div>
          <div className="mb-6"><label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">选择贵金属</label><div className="relative"><select className="w-full bg-gray-50 dark:bg-[#1a1a1a] px-3 py-4 rounded-2xl mt-1 font-bold text-gray-900 dark:text-gray-100 outline-none appearance-none" value={foundAsset?.symbol || ''} onChange={async (e) => { const selectedSymbol = e.target.value; if (!selectedSymbol) { setFoundAsset(null); return; } setIsLoadingMetal(true); setMetalError(null); setFoundAsset(null); try { const response = await fetch(`/api/search?symbol=${encodeURIComponent(selectedSymbol)}&type=metal`); const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.error || '获取贵金属数据失败'); setFoundAsset({ symbol: data.symbol, name: data.name, price: data.price, changePercent: data.changePercent, market: data.market || '贵金属', currency: data.currency || 'CNY', type: 'metal', source: data.source, logoUrl: undefined, }); setHoldings(""); setPurchaseDate(""); setCostPrice(""); setMarketValue(null); } catch (err: any) { setMetalError(err.message); } finally { setIsLoadingMetal(false); } }}><option value="">请选择贵金属</option>{metalOptions.map(metal => (<option key={metal.symbol} value={metal.symbol}>{metal.name}</option>))}</select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={20} /></div></div>
          {isLoadingMetal && <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>}
          {metalError && <div className="text-center py-10"><AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" /><p className="text-red-500 font-bold">{metalError}</p></div>}
          {foundAsset && !isLoadingMetal && (
            <div className="bg-white dark:bg-[#0a0a0a] border-2 border-blue-500 p-6 rounded-[32px] shadow-xl shadow-blue-50 dark:shadow-blue-900/20 animate-in zoom-in-95 duration-300 -mx-0.5">
              <div className="flex flex-col gap-2 mb-6"><div className="flex items-center gap-2"><span className="bg-blue-600 text-[10px] text-white px-2 py-0.5 rounded-md font-bold uppercase">贵金属</span><span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">{foundAsset.type?.toUpperCase()}</span></div><div className="flex justify-between items-center"><h4 className="text-3xl font-black text-gray-900 dark:text-gray-100">{foundAsset.name}</h4><div className="text-right"><p className="text-2xl font-black text-gray-900 dark:text-gray-100 flex justify-end items-center gap-1">{currencySymbolMap[foundAsset.currency] || foundAsset.currency}<span>{(foundAsset.price ?? 0).toFixed(2)}</span></p><p className={`text-xs font-bold ${(foundAsset.changePercent ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>{(foundAsset.changePercent ?? 0) >= 0 ? '+' : ''}{(foundAsset.changePercent ?? 0).toFixed(2)}%</p></div></div><p className="text-sm font-bold text-gray-400 dark:text-gray-500">{foundAsset.symbol}</p></div>
              <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800"><div><label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">持有数量 (克)</label><div className="flex items-center gap-3"><input type="number" placeholder="0.00" className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-blue-500" value={holdings} onChange={(e) => setHoldings(e.target.value)} step="0.01" />{marketValue !== null && <div className="font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap">{currencySymbolMap[foundAsset.currency]}{marketValue.toFixed(2)}</div>}</div></div><div><label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">买入日期</label><input type="date" className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-blue-500 appearance-none" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} /></div><div><label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">买入价 (每克)</label><input type="number" placeholder="0.00" className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-blue-500" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} step="0.01" /></div><button onClick={handleAddAsset} disabled={!holdings} className="w-full bg-blue-600 text-white font-black py-4 rounded-[20px] shadow-lg shadow-blue-200 dark:shadow-blue-900/20 active:scale-[0.98] transition-all disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed">确认添加</button></div>
            </div>
          )}
          {!foundAsset && !isLoadingMetal && !metalError && <div className="text-center py-10"><p className="text-gray-400 dark:text-gray-500">请先选择贵金属</p></div>}
        </div>
      );
    }
    if (selectedAssetType === 'real_estate') {
      return (
        <div ref={scrollContainerRef} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} className="flex flex-col animate-in fade-in slide-in-from-right duration-300 max-h-[70vh] overflow-y-auto">
          <div className="flex items-center gap-4 mb-8"><button onClick={handleBack} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-500 dark:text-gray-300"><ArrowLeft size={20} /></button><h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">添加不动产</h3></div>
          <div className="min-h-[200px]">{renderRealEstateForm()}</div>
        </div>
      );
    }
    if (selectedAssetType === 'custom') {
      return (
        <div ref={scrollContainerRef} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} className="flex flex-col animate-in fade-in slide-in-from-right duration-300 max-h-[70vh] overflow-y-auto">
          <div className="flex items-center gap-4 mb-8"><button onClick={handleBack} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-500 dark:text-gray-300"><ArrowLeft size={20} /></button><h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">添加现金</h3></div>
          <div className="min-h-[200px]">{renderCashForm()}</div>
        </div>
      );
    }
    if (selectedAssetType === 'custom_asset') {
      return (
        <div ref={scrollContainerRef} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} className="flex flex-col animate-in fade-in slide-in-from-right duration-300 max-h-[70vh] overflow-y-auto">
          <div className="flex items-center gap-4 mb-8"><button onClick={handleBack} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-500 dark:text-gray-300"><ArrowLeft size={20} /></button><h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">添加自定义</h3></div>
          <div className="min-h-[200px]">{renderCustomAssetForm()}</div>
        </div>
      );
    }
    // 其他类型（股票、基金、加密货币）的搜索界面
    return (
      <div ref={scrollContainerRef} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} className="flex flex-col animate-in fade-in slide-in-from-right duration-300 max-h-[70vh] overflow-y-auto">
        <div className="flex items-center gap-4 mb-8"><button onClick={handleBack} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-500 dark:text-gray-300"><ArrowLeft size={20} /></button><h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">搜索{selectedAssetType === 'stock' && '股票'}{selectedAssetType === 'etf' && 'ETF'}{selectedAssetType === 'fund' && '基金'}{selectedAssetType === 'crypto' && '加密货币'}</h3></div>
        <div className="relative mb-8"><Search className="absolute left-5 top-6 text-gray-400 dark:text-gray-500" size={20} /><input autoFocus type="text" placeholder="输入代码" className="w-full bg-gray-50 dark:bg-[#1a1a1a] border-2 border-gray-100 dark:border-gray-800 p-5 pl-14 rounded-[24px] outline-none focus:bg-white dark:focus:bg-[#2a2a2a] transition-all font-bold text-gray-900 dark:text-gray-100 text-lg placeholder:text-gray-300 dark:placeholder:text-gray-500" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={handleKeyDown} ref={inputRef} /><p className="text-xs text-gray-400 dark:text-gray-500 mt-2 ml-1">{selectedAssetType === 'stock' && '支持美股 (AAPL)、A股 (600519)、港股(9988)'}{selectedAssetType === 'etf' && '支持ETF (VOO, SPY)'}{selectedAssetType === 'fund' && '基金代码 (如 017174)'}{selectedAssetType === 'crypto' && '加密货币 (BTC, ETH, SOL)'}</p></div>
        <div className="min-h-[200px]">
          {isLoading ? (<div className="flex flex-col items-center py-10 gap-3"><Loader2 className="animate-spin text-blue-600 dark:text-blue-400" size={32} /><p className="text-sm font-bold text-gray-400 dark:text-gray-500">正在调取行情...</p></div>) : searchError ? (<div className="text-center py-10"><AlertCircle className="w-12 h-12 text-red-400 dark:text-red-500 mx-auto mb-3" /><p className="text-red-500 dark:text-red-400 font-bold italic">{searchError}</p></div>) : foundAsset ? (
            <div className="bg-white dark:bg-[#0a0a0a] border-2 border-blue-500 p-6 rounded-[32px] shadow-xl shadow-blue-50 dark:shadow-blue-900/20 animate-in zoom-in-95 duration-300">
              <div className="flex flex-col gap-2 mb-6"><div className="flex items-center gap-2"><span className="bg-blue-600 text-[10px] text-white px-2 py-0.5 rounded-md font-bold uppercase">{foundAsset.market}</span>{foundAsset.type && <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">{foundAsset.type.toUpperCase()}</span>}</div><div className="flex justify-between items-center"><h4 className="text-3xl font-black text-gray-900 dark:text-gray-100">{foundAsset.name}</h4><div className="text-right"><p className="text-2xl font-black text-gray-900 dark:text-gray-100 flex justify-end items-center gap-1">{currencySymbolMap[foundAsset.currency] || foundAsset.currency}<span>{(foundAsset.price ?? 0).toFixed(2)}</span></p>{foundAsset.type === 'real_estate' && (foundAsset.changePercent ?? 0) === 0 ? (<p className="text-xs font-bold text-gray-400">暂无涨跌</p>) : (<p className={`text-xs font-bold ${(foundAsset.changePercent ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>{(foundAsset.changePercent ?? 0) >= 0 ? '+' : ''}{(foundAsset.changePercent ?? 0).toFixed(2)}%</p>)}</div></div><p className="text-sm font-bold text-gray-400 dark:text-gray-500">{foundAsset.symbol}</p></div>
              <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800"><div><label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">持有份额</label><div className="flex items-center gap-3"><input type="number" placeholder="0.00" className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-blue-500" value={holdings} onChange={(e) => setHoldings(e.target.value)} step="0.01" />{marketValue !== null && <div className="font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap">{currencySymbolMap[foundAsset.currency]}{marketValue.toFixed(2)}</div>}</div></div><div><label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">买入日期</label><input type="date" className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-blue-500 appearance-none" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} /></div><div><label className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">买入价</label><input type="number" placeholder="0.00" className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl mt-1 font-bold text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-blue-500" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} step="0.01" /></div><button onClick={handleAddAsset} disabled={!holdings} className="w-full bg-blue-600 text-white font-black py-4 rounded-[20px] shadow-lg shadow-blue-200 dark:shadow-blue-900/20 active:scale-[0.98] transition-all disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed">确认添加</button></div>
            </div>
          ) : searchQuery.length >= 2 ? (<div className="text-center py-10"><p className="text-gray-300 dark:text-gray-600 font-bold italic">未找到该代码，请确保输入正确</p><p className="text-gray-400 dark:text-gray-500 text-sm mt-2">尝试输入其他代码</p></div>) : null}
        </div>
      </div>
    );
  };

  return (
    <>
      {showMenu && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity" onClick={() => setShowMenu(false)} />
      )}
      <div className={`fixed bottom-0 left-0 right-0 bg-white dark:bg-[#0a0a0a] rounded-t-[40px] z-50 p-8 pb-12 transition-transform duration-500 ease-in-out transform ${showMenu ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-8" />
        {view === 'categories' && (
          <>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">添加资产类别</h3>
            <div className="flex flex-col gap-4">
              <button onClick={() => handleMainCategoryClick('liquid')} className="flex items-center justify-between p-5 bg-blue-50 dark:bg-blue-900/30 rounded-[28px] border border-blue-100 dark:border-blue-800 group active:scale-[0.98] transition-all"><div className="flex items-center gap-4"><div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/20"><BsLightningChargeFill size={24} /></div><div className="text-left"><p className="font-bold text-blue-900 dark:text-blue-300 text-lg">流动资产</p><p className="text-xs text-blue-600/70 dark:text-blue-400/70 font-medium">股票、基金、加密货币、贵金属</p></div></div><ChevronRight className="text-blue-300 dark:text-blue-500 group-active:translate-x-1 transition-transform" /></button>
              <button onClick={() => handleMainCategoryClick('fixed')} className="flex items-center justify-between p-5 bg-blue-50 dark:bg-blue-900/30 rounded-[28px] border border-blue-100 dark:border-blue-800 group active:scale-[0.98] transition-all"><div className="flex items-center gap-4"><div className="bg-yellow-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/20"><MdRealEstateAgent size={24} /></div><div className="text-left"><p className="font-bold text-blue-900 dark:text-blue-300 text-lg">固定资产</p><p className="text-xs text-blue-600/70 dark:text-blue-400/70 font-medium">房产、汽车、其他固定资产</p></div></div><ChevronRight className="text-blue-300 dark:text-blue-500 group-active:translate-x-1 transition-transform" /></button>
              <button onClick={() => handleMainCategoryClick('custom')} className="flex items-center justify-between p-5 bg-blue-50 dark:bg-blue-900/30 rounded-[28px] border border-blue-100 dark:border-blue-800 group active:scale-[0.98] transition-all"><div className="flex items-center gap-4"><div className="bg-green-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/20"><IoMdCash size={24} /></div><div className="text-left"><p className="font-bold text-blue-900 dark:text-blue-300 text-lg">现金/收支账户</p><p className="text-xs text-blue-600/70 dark:text-blue-400/70 font-medium">现金、活期存款、收支账户</p></div></div><ChevronRight className="text-blue-300 dark:text-blue-500 group-active:translate-x-1 transition-transform" /></button>
              <button onClick={() => { setSelectedAssetType('custom_asset'); setView('search'); setSearchQuery(''); setFoundAsset(null); setSearchError(null); setHoldings(""); setPurchaseDate(""); setCostPrice(""); setCustomAssetType(''); setCustomAssetName(''); setCustomAssetAmount(''); setCustomAssetOrderDate(''); setCustomAssetNotes(''); setCustomAssetIncludeInChart(true); setBrandsList([]); setSelectedBrandId(''); setSelectedBrandName(''); }} className="flex items-center justify-between p-5 bg-blue-50 dark:bg-blue-900/30 rounded-[28px] border border-blue-100 dark:border-blue-800 group active:scale-[0.98] transition-all"><div className="flex items-center gap-4"><div className="bg-purple-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/20"><Activity size={24} /></div><div className="text-left"><p className="font-bold text-blue-900 dark:text-blue-300 text-lg">自定义</p><p className="text-xs text-blue-600/70 dark:text-blue-400/70 font-medium">负债、应收款、收藏品、其他</p></div></div><ChevronRight className="text-blue-300 dark:text-blue-500 group-active:translate-x-1 transition-transform" /></button>
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
        className="fixed bottom-24 right-6 w-16 h-16 bg-[#ff8800] rounded-full shadow-2xl shadow-blue-200 dark:shadow-blue-900/30 flex items-center justify-center text-white z-[45] active:scale-90 transition-transform"
      >
        <Plus size={36} strokeWidth={3} />
      </button>
      {showBrandSelector && (
        <BrandSelector brands={brandsList} onSelect={(brand) => { setSelectedBrandId(brand.id); setSelectedBrandName(brand.name); setShowBrandSelector(false); }} onClose={() => setShowBrandSelector(false)} />
      )}
      {showIconPage && (
        <IconSelector groups={iconGroups} onSelect={(iconFile) => setSelectedIcon(iconFile)} onClose={() => setShowIconPage(false)} />
      )}
    </>
  );
}