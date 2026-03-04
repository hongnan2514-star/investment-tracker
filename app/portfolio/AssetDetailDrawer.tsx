// app/portfolio/AssetDetailDrawer.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Asset } from '@/src/constants/types';
import { getAssetBySymbol, addAsset } from '@/src/utils/assetStorage';
import { eventBus } from '@/src/utils/eventBus';
import { getCachedLogo } from '@/src/utils/logoCache';
import { useCurrency, useCurrencyConverter } from '@/src/services/currency';
import { CryptoChart, StockChart, ChartRange } from './charts'; // 导入图表组件和类型

interface AssetDetailDrawerProps {
  symbol: string | null;
  onClose: () => void;
  isOpen: boolean;
}

export default function AssetDetailDrawer({ symbol, onClose, isOpen }: AssetDetailDrawerProps) {
  const [asset, setAsset] = useState<Asset | null>(null);
  const [convertedAsset, setConvertedAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [selectedRange, setSelectedRange] = useState<ChartRange>('15m'); // 图表时间范围

  const [isBuyDateFocused, setIsBuyDateFocused] = useState(false);
  const [isSellDateFocused, setIsSellDateFocused] = useState(false);
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
    setLoading(true);
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
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
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
          <p className="text-gray-500 dark:text-gray-400">未找到对应的资产信息</p >
        </div>
      </div>
    );
  }

  const displayAsset = convertedAsset || asset;
  const cachedLogo = getCachedLogo(asset.symbol);
  const logoSrc = cachedLogo || asset.logoUrl;
  const currencySymbol = asset.currency === 'CNY' ? '¥' : asset.currency === 'USD' ? '$' : asset.currency;

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

        {/* 资产概览卡片 */}
        <div className="rounded-3xl pb-6 pt-0 px-6 mb-6">
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
            <div className="flex flex-col gap-0 ml-auto ml-10 min-w-[130px]">
              <div className="leading-4">
                <span className="inline-block w-16 text-left text-[10px] text-gray-500 dark:text-gray-400">当前市价</span>
                <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                  {formatLargeNumber(displayAsset.price)}
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
                  {displayAsset.costPrice ? formatLargeNumber(displayAsset.costPrice) : '--'}
                </span>
              </div>
              <div className="leading-4">
                <span className="inline-block w-16 text-left text-[10px] text-gray-500 dark:text-gray-400">持仓金额</span>
                <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                  {formatLargeNumber(displayAsset.marketValue)}
                </span>
              </div>
            </div>
          </div>

          {/* 时间范围按钮组 - 优化样式 */}
{asset.type !== 'crypto' && (
  <div className="flex justify-between mt-4 px-2">
    {(['15m', '1d', '1M', 'since_holding'] as ChartRange[]).map((range) => (
      <button
        key={range}
        onClick={() => setSelectedRange(range)}
        className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
          selectedRange === range
            ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
        }`}
      >
        {range === '15m' ? '15分钟' : range === '1d' ? '1日' : range === '1M' ? '1月' : '持有以来'}
      </button>
    ))}
  </div>
)}

          {/* 走势图容器 */}
          <div className="mt-4 h-45 w-full">
  {asset.type === 'crypto' ? (
    <CryptoChart
      symbol={asset.symbol}
      changePercent={asset.changePercent}
      purchaseDate={asset.purchaseDate}
      costPrice={asset.costPrice}
    />
  ) : asset.type === 'stock' || asset.type === 'etf' ? (
    <StockChart
      symbol={asset.symbol}
      changePercent={asset.changePercent}
      range={selectedRange}
      purchaseDate={asset.purchaseDate}
    />
  ) : (
    <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
      暂无走势图
    </div>
  )}
</div>
        </div>

        {/* 交易卡片 - 加仓/卖出 */}
        <div className="rounded-3xl p-3 md:p-6 mt-6 mb-6">
          <div className="flex flex-row gap-2">
            {/* 左侧加仓/卖出按钮及表单（占3/5） */}
            <div className="w-3/5">
              {/* 加仓/卖出按钮带滑动背景块 */}
              <div className="relative flex bg-gray-200 dark:bg-gray-700 rounded-lg mb-2">
                <div
                  className={`absolute top-0 bottom-0 w-1/2 rounded-lg transition-all duration-300 ease-in-out ${
                    activeTab === 'buy' ? 'left-0 bg-green-600' : 'left-1/2 bg-red-600'
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
                      value={buyQuantity}
                      onChange={(e) => setBuyQuantity(e.target.value)}
                      placeholder="数量"
                      className="w-full bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 p-2 text-xs rounded-lg font-bold text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={buyPrice}
                      onChange={(e) => setBuyPrice(e.target.value)}
                      placeholder="价格"
                      className="w-full bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 p-2 pl-2 text-xs rounded-lg font-bold text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <input
  type={isBuyDateFocused || buyDate ? 'date' : 'text'}
  value={buyDate}
  onChange={(e) => setBuyDate(e.target.value)}
  onFocus={() => setIsBuyDateFocused(true)}
  onBlur={() => setIsBuyDateFocused(false)}
  placeholder="日期"
  className="w-full min-w-0 p-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#1a1a1a] font-bold text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500 appearance-none placeholder:text-gray-500"
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
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={sellPrice}
                      onChange={(e) => setSellPrice(e.target.value)}
                      placeholder="价格"
                      className="w-full bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 p-2 pl-2 text-xs rounded-lg font-bold text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <input
  type={isSellDateFocused || sellDate ? 'date' : 'text'}
  value={sellDate}
  onChange={(e) => setSellDate(e.target.value)}
  onFocus={() => setIsSellDateFocused(true)}
  onBlur={() => setIsSellDateFocused(false)}
  placeholder="日期"
  className="w-full min-w-0 p-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#1a1a1a] font-bold text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500 appearance-none placeholder:text-gray-500"
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
                <p className="text-[9px] text-gray-400 dark:text-gray-500 text-center py-1">暂无记录</p>
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
      </div>
    </div>
  );
}