// app/portfolio/[symbol]/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, TrendingUp, TrendingDown, Calendar, DollarSign } from 'lucide-react';
import { Asset } from '@/src/constants/types';
import { getAssets, addAsset, getAssetBySymbol } from '@/src/utils/assetStorage';
import { eventBus } from '@/src/utils/eventBus';
import { getCachedLogo } from '@/src/utils/logoCache';
import { useTheme } from '@/app/ThemeProvider';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';

export default function AssetDetailPage() {
  const { symbol } = useParams() as { symbol: string };
  const router = useRouter();
  const { theme } = useTheme();
  const [asset, setAsset] = useState<Asset | null>(null);
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

  useEffect(() => {
    const found = getAssetBySymbol(decodeURIComponent(symbol));
    setAsset(found || null);
    setLoading(false);
  }, [symbol]);

  useEffect(() => {
    if (!asset) return;
    const fetchHistory = async () => {
      try {
        const res = await fetch(`/api/history?symbol=${encodeURIComponent(asset.symbol)}&type=${asset.type}`);
        const json = await res.json();
        if (json.success) {
          setAssetHistory(json.data.map((item: any) => ({ value: item.value })));
        }
      } catch (error) {
        console.error('获取历史失败', error);
      }
    };
    fetchHistory();
  }, [asset]);

  const formatCurrency = (value: number, currency: string = 'CNY') => {
    const symbolMap: Record<string, string> = { CNY: '¥', USD: '$' };
    return `${symbolMap[currency] || currency}${value.toFixed(2)}`;
  };

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
  
  // 模拟交易记录（后续可从资产对象中读取）
const mockBuyRecords = [
  { date: '2024-02-20', quantity: 100, price: 310.5 },
  { date: '2024-02-15', quantity: 50, price: 305.2 },
  { date: '2024-02-10', quantity: 200, price: 298.0 },
];
const mockSellRecords = [
  { date: '2024-02-18', quantity: 30, price: 320.0 },
  { date: '2024-02-12', quantity: 80, price: 315.5 },
];
const [transactionHistory, setTransactionHistory] = useState(mockBuyRecords);

// 当选项卡切换时更新记录列表
useEffect(() => {
  setTransactionHistory(activeTab === 'buy' ? mockBuyRecords : mockSellRecords);
}, [activeTab]);

  const formatLargeNumber = (num: number): string => {
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(2) + 'K';
    return num.toFixed(2);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black p-4 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">加载中...</div>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black p-4">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-4">
          <ArrowLeft size={20} />
          <span>返回</span>
        </button>
        <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl p-8 text-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">资产不存在</h2>
          <p className="text-gray-500 dark:text-gray-400">未找到对应的资产信息</p >
        </div>
      </div>
    );
  }

  const currencySymbol = asset.currency === 'CNY' ? '¥' : asset.currency === 'USD' ? '$' : asset.currency;
  const cachedLogo = getCachedLogo(asset.symbol);
  const logoSrc = cachedLogo || asset.logoUrl;

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-black p-4">
      {/* 返回按钮 */}
      <button
        onClick={() => router.back()}
        className="text-gray-500 dark:text-gray-400 mb-6 p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
        aria-label="返回"
      >
        <ArrowLeft size={24} />
      </button>

      {/* 资产概览卡片 */}
      <div className=" rounded-3xl p-6 shadow-lg mb-6">
        {/* 顶部行：左侧Logo+名称，右侧四个指标竖排 */}
<div className="flex justify-between items-start gap-4 max-w-full overflow-hidden">
  {/* 左侧 Logo 和名称 */}
  <div className="flex items-center gap-3 min-w-0 flex-1">
    {logoSrc ? (
      < img src={logoSrc} alt={asset.name} className="w-12 h-12 object-contain rounded-lg flex-shrink-0" />
    ) : (
      <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 text-xl font-bold flex-shrink-0">
        {asset.name.charAt(0).toUpperCase()}
      </div>
    )}
    <div className="min-w-0">
      <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 truncate">{asset.name}</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{asset.symbol}</p >
    </div>
  </div>

  {/* 右侧四个指标竖排 */}
<div className="flex flex-col gap-0 ml-auto min-w-[130px]">
  <div className="leading-4">
    <span className="inline-block w-16 text-left text-[10px] text-gray-500 dark:text-gray-400">当前市价</span>
    <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
      {asset.currency === 'CNY' ? '¥' : asset.currency === 'USD' ? '$' : asset.currency}
      {formatLargeNumber(asset.price)}
    </span>
  </div>
  <div className="leading-4">
    <span className="inline-block w-16 text-left text-[10px] text-gray-500 dark:text-gray-400">持仓数量</span>
    <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
      {formatLargeNumber(asset.holdings)}
    </span>
  </div>
  <div className="leading-4">
    <span className="inline-block w-16 text-left text-[10px] text-gray-500 dark:text-gray-400">成本均价</span>
    <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
      {asset.costPrice ? (
        <>
          {asset.currency === 'CNY' ? '¥' : asset.currency === 'USD' ? '$' : asset.currency}
          {formatLargeNumber(asset.costPrice)}
        </>
      ) : '--'}
    </span>
  </div>
  <div className="leading-4">
    <span className="inline-block w-16 text-left text-[10px] text-gray-500 dark:text-gray-400">当前市值</span>
    <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
      {asset.currency === 'CNY' ? '¥' : asset.currency === 'USD' ? '$' : asset.currency}
      {formatLargeNumber(asset.marketValue)}
    </span>
  </div>
</div>
        </div>

        {/* 走势图 */}
        <div className="mt-4 h-24 w-full">
          {assetHistory.length < 2 ? (
            <div className="w-full h-full flex items-center justify-center text-xs text-gray-400 dark:text-gray-500">
              暂无数据
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={assetHistory}>
                <YAxis domain={['auto', 'auto']} hide={true} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={asset.changePercent && asset.changePercent >= 0 ? '#22c55e' : '#ef4444'}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 交易卡片 - 加仓/卖出 */}
<div className="rounded-3xl p-3 md:p-6 shadow-lg mb-6">
  <div className="flex flex-row gap-2">
    {/* 左侧加仓/卖出按钮及表单（占3/5） */}
    <div className="w-3/5">
      {/* 加仓/卖出按钮带滑动背景块 */}
      <div className="relative flex bg-gray-200 dark:bg-gray-700 rounded-lg p-1 mb-2">
        <div
          className={`absolute top-1 bottom-1 w-1/2 rounded-lg transition-transform duration-300 ease-in-out ${
            activeTab === 'buy' ? 'bg-green-600 translate-x-0' : 'bg-red-600 translate-x-full'
          }`}
        />
        <button
          className={`flex-1 py-2 text-xs font-bold rounded-lg relative z-10 ${
            activeTab === 'buy' ? 'text-white' : 'text-gray-700 dark:text-gray-300'
          }`}
          onClick={() => setActiveTab('buy')}
        >
          加仓
        </button>
        <button
          className={`flex-1 py-2 text-xs font-bold rounded-lg relative z-10 ${
            activeTab === 'sell' ? 'text-white' : 'text-gray-700 dark:text-gray-300'
          }`}
          onClick={() => setActiveTab('sell')}
        >
          卖出
        </button>
      </div>

      {/* 加仓表单 */}
      {activeTab === 'buy' && (
        <div className="space-y-2">
          <div>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={asset.holdings}
              value={sellQuantity}
              onChange={(e) => setSellQuantity(e.target.value)}
              placeholder="数量"
              className="w-full bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 p-2 text-xs rounded-lg font-bold text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500"
            />
          </div>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-xs">{currencySymbol}</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={sellPrice}
              onChange={(e) => setSellPrice(e.target.value)}
              placeholder="价格"
              className="w-full bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 p-2 pl-6 text-xs rounded-lg font-bold text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <input
  type="date"
  value={activeTab === 'buy' ? buyDate : sellDate}
  onChange={(e) => activeTab === 'buy' ? setBuyDate(e.target.value) : setSellDate(e.target.value)}
  className="w-full min-w-0 p-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#1a1a1a] font-bold text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500 appearance-none"
  style={{ minWidth: 0 }}
/>
          </div>
          <button
            onClick={handleBuy}
            disabled={!buyQuantity || !buyPrice}
            className="w-full bg-green-600 text-white font-bold py-2 text-xs rounded-lg disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            确认加仓
          </button>
        </div>
      )}

      {/* 卖出表单 */}
      {activeTab === 'sell' && (
        <div className="space-y-2">
          <div>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={asset.holdings}
              value={sellQuantity}
              onChange={(e) => setSellQuantity(e.target.value)}
              placeholder="数量"
              className="w-full bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 p-2 text-xs rounded-lg font-bold text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500"
            />
          </div>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-xs">{currencySymbol}</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={sellPrice}
              onChange={(e) => setSellPrice(e.target.value)}
              placeholder="价格"
              className="w-full bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 p-2 pl-6 text-xs rounded-lg font-bold text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <input
  type="date"
  value={activeTab === 'sell' ? sellDate : buyDate}
  onChange={(e) => activeTab === 'sell' ? setSellDate(e.target.value) : setBuyDate(e.target.value)}
  className="w-full min-w-0 p-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#1a1a1a] font-bold text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500 appearance-none"
  style={{ minWidth: 0 }}
/>
          </div>
          <button
            onClick={handleSell}
            disabled={!sellQuantity || !sellPrice}
            className="w-full bg-red-600 text-white font-bold py-2 text-xs rounded-lg disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            确认卖出
          </button>
        </div>
      )}
    </div>

    {/* 右侧最近操作记录（占2/5） */}
    <div className="w-2/5 border-l border-gray-200 dark:border-gray-700 pl-2">
      <h4 className="text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1">
        {activeTab === 'buy' ? '最近加仓记录' : '最近卖出记录'}
      </h4>
      {transactionHistory.length === 0 ? (
        <p className="text-[9px] text-gray-400 dark:text-gray-500 text-center py-1">暂无记录</p >
      ) : (
        <div className="space-y-1 max-h-24 overflow-y-auto">
          {transactionHistory.map((record, idx) => (
            <div key={idx} className="flex justify-between items-center text-[9px] bg-gray-50 dark:bg-[#1a1a1a] p-1 rounded">
              <span className="text-gray-600 dark:text-gray-400">{record.date.slice(5)}</span>
              <span className="font-bold text-gray-900 dark:text-gray-100">{record.quantity}</span>
              <span className="font-bold text-gray-900 dark:text-gray-100">
                {currencySymbol}{record.price.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
</div>


      {/* 消息提示 */}
      {message && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-sm font-bold ${
          message.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {message.text}
        </div>
      )}
    </main>
  );
}