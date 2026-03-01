// app/portfolio/AssetDetailDrawer.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Asset } from '@/src/constants/types';
import { getAssets, getAssetBySymbol, addAsset } from '@/src/utils/assetStorage';
import { eventBus } from '@/src/utils/eventBus';
import { getCachedLogo } from '@/src/utils/logoCache';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { useCurrency, useCurrencyConverter } from '@/src/services/currency';

interface AssetDetailDrawerProps {
  symbol: string | null;
  onClose: () => void;
  isOpen: boolean;
}

export default function AssetDetailDrawer({ symbol, onClose, isOpen }: AssetDetailDrawerProps) {
  const [asset, setAsset] = useState<Asset | null>(null);
  const [convertedAsset, setConvertedAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [assetHistory, setAssetHistory] = useState<{ value: number }[]>([]);
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');

  // 加仓表单
  const [buyQuantity, setBuyQuantity] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [buyDate, setBuyDate] = useState('');

  // 卖出表单
  const [sellQuantity, setSellQuantity] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [sellDate, setSellDate] = useState('');

  // 错误/成功提示
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { currency } = useCurrency();
  const { convert } = useCurrencyConverter();

  // 加载资产数据
  const loadAsset = () => {
    if (!symbol) return;
    const found = getAssetBySymbol(decodeURIComponent(symbol));
    setAsset(found ? { ...found } : null);
    setLoading(false);
  };

  useEffect(() => {
    loadAsset();
    const unsubscribe = eventBus.subscribe('assetsUpdated', loadAsset);
    return () => unsubscribe();
  }, [symbol]);

  // 货币转换
  useEffect(() => {
    const convertAsset = async () => {
      if (!asset) {
        setConvertedAsset(null);
        return;
      }
      const fromCurrency = asset.currency || 'USD';
      const [newPrice, newMarketValue, newCostPrice] = await Promise.all([
        convert(asset.price, fromCurrency as any, currency),
        convert(asset.marketValue, fromCurrency as any, currency),
        asset.costPrice ? convert(asset.costPrice, fromCurrency as any, currency) : Promise.resolve(undefined),
      ]);
      setConvertedAsset({
        ...asset,
        price: newPrice,
        marketValue: newMarketValue,
        costPrice: newCostPrice,
      });
    };
    convertAsset();
  }, [asset, currency, convert]);

  // 获取走势图数据
  useEffect(() => {
    if (!asset) return;
    const fetchHistory = async () => {
      try {
        const res = await fetch(`/api/history?symbol=${encodeURIComponent(asset.symbol)}&type=${asset.type}&range=1h&limit=40`);
        const json = await res.json();
        if (json.success && json.data?.length > 0) {
          setAssetHistory(json.data.map((item: any) => ({ value: item.value })));
        }
      } catch (error) {
        console.error('获取历史数据失败', error);
      }
    };
    fetchHistory();
  }, [asset]);

  const handleBuy = () => {
    if (!asset) return;
    const qty = parseFloat(buyQuantity);
    const price = parseFloat(buyPrice);
    if (isNaN(qty) || qty <= 0 || isNaN(price) || price < 0) {
      setMessage({ type: 'error', text: '请输入有效的数量和价格' });
      return;
    }

    const totalCostOld = asset.holdings * (asset.costPrice || 0);
    const totalCostNew = totalCostOld + qty * price;
    const newHoldings = asset.holdings + qty;
    const newCostPrice = totalCostNew / newHoldings;

    const updatedAsset: Asset = {
      ...asset,
      holdings: newHoldings,
      costPrice: newCostPrice,
      marketValue: newHoldings * asset.price,
      lastUpdated: new Date().toISOString(),
    };

    addAsset(updatedAsset);
    setAsset(updatedAsset);
    eventBus.emit('assetsUpdated');
    setMessage({ type: 'success', text: '加仓成功' });
    setBuyQuantity('');
    setBuyPrice('');
    setBuyDate('');
  };

  const handleSell = () => {
    if (!asset) return;
    const qty = parseFloat(sellQuantity);
    const price = parseFloat(sellPrice);
    if (isNaN(qty) || qty <= 0 || qty > asset.holdings || isNaN(price) || price < 0) {
      setMessage({ type: 'error', text: '卖出数量无效或超过持仓' });
      return;
    }

    const newHoldings = asset.holdings - qty;
    const updatedAsset: Asset = {
      ...asset,
      holdings: newHoldings,
      marketValue: newHoldings * asset.price,
      lastUpdated: new Date().toISOString(),
    };

    addAsset(updatedAsset);
    setAsset(updatedAsset);
    eventBus.emit('assetsUpdated');
    setMessage({ type: 'success', text: '卖出成功' });
    setSellQuantity('');
    setSellPrice('');
    setSellDate('');
  };

  // 模拟交易记录
  const mockBuyRecords = [
    { date: '2024-02-20', quantity: 100, price: 310.5 },
    { date: '2024-02-15', quantity: 50, price: 305.2 },
    { date: '2024-02-10', quantity: 200, price: 298.0 },
  ];
  const mockSellRecords = [
    { date: '2024-02-18', quantity: 30, price: 320.0 },
    { date: '2024-02-12', quantity: 80, price: 315.5 },
  ];
  const transactionHistory = activeTab === 'buy' ? mockBuyRecords : mockSellRecords;

  const formatLargeNumber = (num: number): string => {
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(2) + 'K';
    return num.toFixed(2);
  };

  if (!symbol || !isOpen) return null;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-white dark:bg-black z-50 p-4 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">加载中...</div>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="fixed inset-0 bg-white dark:bg-black z-50 p-4 overflow-y-auto">
        <button onClick={onClose} className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-4">
          <ArrowLeft size={20} />
          <span>返回</span>
        </button>
        <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl p-8 text-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">资产不存在</h2>
          <p className="text-gray-500 dark:text-gray-400">未找到对应的资产信息</p>
        </div>
      </div>
    );
  }

  const displayAsset = convertedAsset || asset;
  const cachedLogo = getCachedLogo(asset.symbol);
  const logoSrc = cachedLogo || asset.logoUrl;

  return (
    <div className={`fixed inset-0 bg-white dark:bg-black z-50 overflow-y-auto transition-transform duration-300 ease-in-out transform ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="p-4">
        {/* 返回按钮 */}
        <button
          onClick={onClose}
          className="text-gray-500 dark:text-gray-400 mb-6 p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          aria-label="返回"
        >
          <ArrowLeft size={24} />
        </button>

        {/* 资产概览卡片（完全复制原 AssetDetailPage 的内容） */}
        <div className="rounded-3xl pb-6 pt-0 px-6 mb-6">
          {/* 此处粘贴原 AssetDetailPage 中从资产概览卡片开始到走势图结束的 JSX，注意使用 displayAsset 等变量 */}
          {/* 为了简洁，省略具体 JSX，实际使用时请完整复制 */}
          {/* ... */}
        </div>

        {/* 交易卡片（同样复制原内容） */}
        <div className="rounded-3xl p-3 md:p-6 mt-6 mb-6">
          {/* ... */}
        </div>

        {/* 消息提示 */}
        {message && (
          <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-sm font-bold ${
            message.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}>
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
}