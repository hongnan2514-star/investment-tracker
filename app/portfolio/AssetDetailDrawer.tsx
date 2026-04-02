// app/portfolio/AssetDetailDrawer.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Asset } from '@/src/constants/types';
import { getAssetBySymbol, addAsset, getCurrentUserId } from '@/src/utils/assetStorage';
import { eventBus } from '@/src/utils/eventBus';
import { getCachedLogo } from '@/src/utils/logoCache';
import { useCurrency, useCurrencyConverter } from '@/src/services/currency';
import { CryptoChart, StockChart, FundChart, MetalChart } from './charts';
import TransactionHistory from 'components/TransactionHistory';
import AssetStats from '@/components/AssetStats';

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

  const [buyQuantity, setBuyQuantity] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [buyDate, setBuyDate] = useState('');
  const [sellQuantity, setSellQuantity] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [sellDate, setSellDate] = useState('');

  // 按钮提交状态（用于显示临时成功文字并禁用按钮）
  const [isBuySubmitting, setIsBuySubmitting] = useState(false);
  const [isSellSubmitting, setIsSellSubmitting] = useState(false);

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const { currency } = useCurrency();
  const { convert } = useCurrencyConverter();

  // 从后端加载资产
  const loadAsset = async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const userId = getCurrentUserId();
      if (!userId) {
        setAsset(null);
        return;
      }
      const res = await fetch('/api/asset', {
        headers: { 'x-user-id': userId },
      });
      if (res.ok) {
        const data = await res.json();
        const targetSymbol = decodeURIComponent(symbol);
        const found = data.find((item: any) => item.symbol === targetSymbol);
        if (found) {
          const normalized: Asset = {
            ...found,
            price: Number(found.price),
            holdings: Number(found.holdings),
            marketValue: Number(found.marketValue),
            costPrice: found.costPrice ? Number(found.costPrice) : undefined,
            changePercent: found.changePercent ? Number(found.changePercent) : 0,
          };
          setAsset(normalized);
        } else {
          setAsset(null);
        }
      } else {
        console.error('加载资产失败', res.status);
        setAsset(null);
      }
    } catch (err) {
      console.error('加载资产失败', err);
      setAsset(null);
    } finally {
      setLoading(false);
    }
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
      let newPrice = asset.price;
      let newMarketValue = asset.marketValue;
      let newCostPrice = asset.costPrice;

      try {
        const [convertedPrice, convertedMarketValue, convertedCostPrice] = await Promise.all([
          convert(asset.price, fromCurrency as any, currency),
          convert(asset.marketValue, fromCurrency as any, currency),
          asset.costPrice ? convert(asset.costPrice, fromCurrency as any, currency) : Promise.resolve(undefined),
        ]);

        if (convertedPrice != null && !isNaN(convertedPrice)) newPrice = convertedPrice;
        if (convertedMarketValue != null && !isNaN(convertedMarketValue)) newMarketValue = convertedMarketValue;
        if (convertedCostPrice != null && !isNaN(convertedCostPrice)) newCostPrice = convertedCostPrice;
      } catch (e) {
        console.error(`转换资产 ${asset.symbol} 失败:`, e);
      }

      setConvertedAsset({
        ...asset,
        price: newPrice,
        marketValue: newMarketValue,
        costPrice: newCostPrice,
      });
    };
    convertAsset();
  }, [asset, currency, convert]);

  const handleBuy = async () => {
    if (!asset) return;
    const qty = parseFloat(buyQuantity);
    const price = parseFloat(buyPrice);
    const userId = getCurrentUserId();
    if (!userId) {
      setMessage({ type: 'error', text: '请先登录' });
      return;
    }
    if (isNaN(qty) || qty <= 0 || isNaN(price) || price < 0) {
      setMessage({ type: 'error', text: '请输入有效的数量和价格' });
      return;
    }

    setIsBuySubmitting(true);
    try {
      const totalCostOld = asset.holdings * (asset.costPrice || 0);
      const totalCostNew = totalCostOld + qty * price;
      const newHoldings = asset.holdings + qty;
      const newCostPrice = totalCostNew / newHoldings;
      const newMarketValue = newHoldings * asset.price;

      const updatedAsset: Asset = {
        ...asset,
        holdings: newHoldings,
        costPrice: newCostPrice,
        marketValue: newMarketValue,
        lastUpdated: new Date().toISOString(),
      };

      await addAsset(updatedAsset);
      await loadAsset();
      eventBus.emit('assetsUpdated');

      // 清空表单
      setBuyQuantity('');
      setBuyPrice('');
      setBuyDate('');

      // 保存交易记录
      await fetch('/api/transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({
          assetSymbol: asset.symbol,
          transactionType: 'buy',
          quantity: qty,
          price: price,
          transactionDate: buyDate,
          currency: asset.currency,
        }),
      });
      setRefreshKey(prev => prev + 1);

      // 2秒后恢复按钮文字
      setTimeout(() => setIsBuySubmitting(false), 2000);
    } catch (err) {
      console.error('加仓失败', err);
      setMessage({ type: 'error', text: '加仓失败，请重试' });
      setIsBuySubmitting(false);
    }
  };

  const handleSell = async () => {
    if (!asset) return;
    const qty = parseFloat(sellQuantity);
    const price = parseFloat(sellPrice);
    const userId = getCurrentUserId();
    if (!userId) {
      setMessage({ type: 'error', text: '请先登录' });
      return;
    }
    if (isNaN(qty) || qty <= 0 || qty > asset.holdings || isNaN(price) || price < 0) {
      setMessage({ type: 'error', text: '卖出数量无效或超过持仓' });
      return;
    }

    setIsSellSubmitting(true);
    try {
      const newHoldings = asset.holdings - qty;
      const newMarketValue = newHoldings * asset.price;

      const updatedAsset: Asset = {
        ...asset,
        holdings: newHoldings,
        marketValue: newMarketValue,
        lastUpdated: new Date().toISOString(),
      };

      await addAsset(updatedAsset);
      await loadAsset();
      eventBus.emit('assetsUpdated');

      setSellQuantity('');
      setSellPrice('');
      setSellDate('');

      await fetch('/api/transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({
          assetSymbol: asset.symbol,
          transactionType: 'sell',
          quantity: qty,
          price: price,
          transactionDate: sellDate,
          currency: asset.currency,
        }),
      });
      setRefreshKey(prev => prev + 1);

      setTimeout(() => setIsSellSubmitting(false), 2000);
    } catch (err) {
      console.error('卖出失败', err);
      setMessage({ type: 'error', text: '卖出失败，请重试' });
      setIsSellSubmitting(false);
    }
  };

  const formatLargeNumber = (num: number): string => {
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(2) + 'K';
    return num.toFixed(2);
  };

  if (!symbol || !isOpen) return null;

  if (loading) {
    return <AssetDetailSkeleton onClose={onClose} />;
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
  const currencySymbol = asset.currency === 'CNY' ? '¥' : asset.currency === 'USD' ? '$' : asset.currency;

  return (
    <div className={`fixed inset-0 bg-white dark:bg-black z-50 overflow-y-auto transition-transform duration-300 ease-in-out transform ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="p-4">
        <button
          onClick={onClose}
          className="text-gray-500 dark:text-gray-400 mb-6 p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          aria-label="返回"
        >
          <ArrowLeft size={24} />
        </button>

        <div className="rounded-3xl pb-6 pt-0 px-6 mb-6">
          <div className="flex justify-between items-start gap-4 max-w-full">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {/* 图标和名称部分保持不变 */}
              {(() => {
                const isAStock = asset.symbol && /^\d{6}\.(SS|SZ)$/.test(asset.symbol);
                const code = isAStock ? asset.symbol.split('.')[0] : null;
                const cachedLogo = getCachedLogo(asset.symbol);

                if (isAStock && code) {
                  const localPath = `/images/company_logos/${code}.png`;
                  return (
                    <img
                      src={localPath}
                      alt={asset.name}
                      className="w-12 h-12 object-contain rounded-lg flex-shrink-0"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  );
                }

                if (cachedLogo || asset.logoUrl) {
                  return (
                    <img
                      src={cachedLogo || asset.logoUrl}
                      alt={asset.name}
                      className="w-12 h-12 object-contain rounded-lg flex-shrink-0"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  );
                }

                return (
                  <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 text-xl font-bold flex-shrink-0">
                    {asset.name.charAt(0).toUpperCase()}
                  </div>
                );
              })()}

              <div className="min-w-0">
                <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 truncate">{asset.name}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{asset.symbol}</p>
              </div>
            </div>

            <AssetStats
              asset={asset}
              displayAsset={displayAsset}
              formatLargeNumber={formatLargeNumber}
            />
          </div>

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
                purchaseDate={asset.purchaseDate}
                costPrice={asset.costPrice}
              />
            ) : asset.type === 'fund' ? (
              <FundChart
                symbol={asset.symbol}
                changePercent={asset.changePercent}
                purchaseDate={asset.purchaseDate}
                costPrice={asset.costPrice}
                currentPrice={displayAsset.price}
              />
            ) : asset.type === 'metal' ? (
              <MetalChart
                symbol={asset.symbol}
                changePercent={asset.changePercent}
                purchaseDate={asset.purchaseDate}
                costPrice={asset.costPrice}
                currentPrice={displayAsset.price}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                暂无走势图
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl p-3 md:p-6 mt-6 mb-6">
          <div className="flex flex-row gap-2">
            <div className="w-3/5">
              {/* 加仓/卖出表单保持不变 */}
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
    type="date"
    value={buyDate}
    onChange={(e) => setBuyDate(e.target.value)}
    placeholder="日期"
    className="w-full min-w-0 p-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#1a1a1a] font-bold text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500 appearance-none"
    style={{ minWidth: 0 }}
  />
</div>
                  <button
                    onClick={handleBuy}
                    disabled={!buyQuantity || !buyPrice || isBuySubmitting}
                    className="w-full bg-green-600 text-white font-bold py-2 text-xs rounded-lg disabled:opacity-50 active:scale-[0.98] transition-transform"
                  >
                    {isBuySubmitting ? '加仓成功' : '确认加仓'}
                  </button>
                </div>
              )}

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
    type="date"
    value={sellDate}
    onChange={(e) => setSellDate(e.target.value)}
    placeholder="日期"
    className="w-full min-w-0 p-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#1a1a1a] font-bold text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500 appearance-none"
    style={{ minWidth: 0 }}
  />
</div>
                  <button
                    onClick={handleSell}
                    disabled={!sellQuantity || !sellPrice || isSellSubmitting}
                    className="w-full bg-red-600 text-white font-bold py-2 text-xs rounded-lg disabled:opacity-50 active:scale-[0.98] transition-transform"
                  >
                    {isSellSubmitting ? '卖出成功' : '确认卖出'}
                  </button>
                </div>
              )}
            </div>

            <div className="w-2/5 border-l border-gray-200 dark:border-gray-700 pl-2">
              <h4 className="text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1">
                {activeTab === 'buy' ? '最近加仓记录' : '最近卖出记录'}
              </h4>
              <TransactionHistory
                assetSymbol={asset.symbol}
                type={activeTab}
                refreshTrigger={refreshKey}
              />
            </div>
          </div>
        </div>

        {/* 仅显示错误消息，成功时不显示圆框 */}
        {message && message.type === 'error' && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-sm font-bold bg-red-600 text-white">
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
}

const AssetDetailSkeleton = ({ onClose }: { onClose: () => void }) => {
  const skeletonBlockClass = "relative overflow-hidden bg-gray-200 dark:bg-gray-700 rounded-xl";
  const shimmerClass = "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent";

  return (
    <div className="fixed inset-0 bg-white dark:bg-black z-50 overflow-y-auto">
      <div className="p-4">
        <button
          onClick={onClose}
          className="text-gray-500 dark:text-gray-400 mb-6 p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          aria-label="返回"
        >
          <ArrowLeft size={24} />
        </button>

        <div className="rounded-3xl pb-6 pt-0 px-6 mb-6">
          <div className="flex justify-between items-start gap-4 max-w-full">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className={`w-12 h-12 rounded-lg ${skeletonBlockClass} ${shimmerClass}`} />
              <div className="min-w-0 flex-1">
                <div className={`h-7 w-32 mb-1 ${skeletonBlockClass} ${shimmerClass}`} />
                <div className={`h-4 w-20 ${skeletonBlockClass} ${shimmerClass}`} />
              </div>
            </div>
            <div className="text-right">
              <div className={`h-5 w-16 ml-auto mb-1 ${skeletonBlockClass} ${shimmerClass}`} />
              <div className={`h-6 w-20 ml-auto ${skeletonBlockClass} ${shimmerClass}`} />
            </div>
          </div>
          <div className={`mt-4 h-45 w-full ${skeletonBlockClass} ${shimmerClass}`} style={{ height: '180px' }} />
        </div>

        <div className="rounded-3xl p-3 md:p-6 mt-6 mb-6">
          <div className="flex flex-row gap-2">
            <div className="w-3/5">
              <div className="relative flex bg-gray-200 dark:bg-gray-700 rounded-lg mb-2 h-9">
                <div className="flex-1 rounded-l-lg bg-gray-300 dark:bg-gray-600"></div>
                <div className="flex-1 rounded-r-lg"></div>
              </div>
              <div className="space-y-2">
                <div className={`h-10 w-full ${skeletonBlockClass} ${shimmerClass}`} />
                <div className={`h-10 w-full ${skeletonBlockClass} ${shimmerClass}`} />
                <div className={`h-10 w-full ${skeletonBlockClass} ${shimmerClass}`} />
                <div className={`h-10 w-full ${skeletonBlockClass} ${shimmerClass}`} />
              </div>
            </div>
            <div className="w-2/5 border-l border-gray-200 dark:border-gray-700 pl-2">
              <div className={`h-4 w-24 mb-2 ${skeletonBlockClass} ${shimmerClass}`} />
              <div className="space-y-2">
                <div className={`h-8 w-full ${skeletonBlockClass} ${shimmerClass}`} />
                <div className={`h-8 w-full ${skeletonBlockClass} ${shimmerClass}`} />
                <div className={`h-8 w-full ${skeletonBlockClass} ${shimmerClass}`} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          100% {
            transform: translateX(200%);
          }
        }
      `}</style>
    </div>
  );
};