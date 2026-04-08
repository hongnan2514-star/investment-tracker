// components/TransactionHistory.tsx
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Circle, CheckCircle } from 'lucide-react';
import { useCurrency, useCurrencyConverter } from '@/src/services/currency';
import { getCurrentUserId } from '@/src/utils/assetStorage';

interface Transaction {
  id: number;
  user_id: string;
  asset_symbol: string;
  transaction_type: 'buy' | 'sell';
  quantity: number;
  price: number;
  transaction_date: string;
  currency: string;
  created_at: string;
}

interface TransactionHistoryProps {
  assetSymbol: string;
  type: 'buy' | 'sell';
  refreshTrigger?: any;
  isSelectMode?: boolean;
  selectedIds?: Set<number>;
  onToggleSelect?: (id: number) => void;
}

const formatLargeNumber = (num: number): string => {
  if (num >= 1_000_000_000_000) return (num / 1_000_000_000_000).toFixed(2) + 'T';
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(2) + 'K';
  return num.toFixed(2);
};

export default function TransactionHistory({ 
  assetSymbol, 
  type, 
  refreshTrigger,
  isSelectMode = false,
  selectedIds = new Set(),
  onToggleSelect
}: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const { currency, symbol: currencySymbol } = useCurrency();
  const { convert } = useCurrencyConverter();
  const requestIdRef = useRef(0);

  const fetchTransactions = async () => {
    const currentRequestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const userId = getCurrentUserId();
      if (!userId) return;
      const url = `/api/transaction?assetSymbol=${encodeURIComponent(assetSymbol)}&type=${type}`;
      const res = await fetch(url, {
        headers: { 'x-user-id': userId },
      });
      if (!res.ok) throw new Error('获取记录失败');
      const data = await res.json();
      if (currentRequestId === requestIdRef.current) {
        setTransactions(data);
      }
    } catch (err) {
      console.error('加载交易记录失败:', err);
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [assetSymbol, type, refreshTrigger]);

  const [convertedAmounts, setConvertedAmounts] = useState<{ [key: number]: number }>({});
  useEffect(() => {
    const convertAll = async () => {
      const newAmounts: { [key: number]: number } = {};
      for (const t of transactions) {
        const amount = t.quantity * t.price;
        const fromCurrency = t.currency;
        let converted = amount;
        if (fromCurrency !== currency) {
          try {
            converted = await convert(amount, fromCurrency as any, currency);
          } catch (e) {
            console.warn(`转换失败: ${t.id}`, e);
          }
        }
        newAmounts[t.id] = converted;
      }
      setConvertedAmounts(newAmounts);
    };
    if (transactions.length > 0) {
      convertAll();
    }
  }, [transactions, currency, convert]);

  if (loading) {
    return <div className="text-center text-xs text-gray-400 py-2">加载中...</div>;
  }

  if (transactions.length === 0) {
    return <p className="text-[9px] text-gray-400 dark:text-gray-500 text-center py-1">暂无记录</p >;
  }

  return (
    <div className="space-y-1 max-h-24 overflow-y-auto">
      {transactions.map((t) => {
        const amount = t.quantity * t.price;
        const displayAmount = convertedAmounts[t.id] ?? amount;
        const isSelected = selectedIds.has(t.id);
        return (
          <div
            key={t.id}
            className={`grid grid-cols-3 items-center text-[9px] bg-gray-50 dark:bg-[#1a1a1a] p-1 rounded group ${isSelectMode ? 'cursor-pointer' : ''}`}
            onClick={() => isSelectMode && onToggleSelect?.(t.id)}
          >
            {isSelectMode && (
              <div className="flex items-center justify-start w-4">
                {isSelected ? (
                  <CheckCircle size={12} className="text-orange-500" />
                ) : (
                  <Circle size={12} className="text-gray-400" />
                )}
              </div>
            )}
            <span className="text-gray-600 dark:text-gray-400 text-left">
              {t.transaction_date.slice(5, 10)}
            </span>
            <span className="font-bold text-gray-900 dark:text-gray-100 text-center">
              {Number(t.quantity).toFixed(4).replace(/\.?0+$/, '')}
            </span>
            <span className="font-bold text-gray-900 dark:text-gray-100 text-right">
              {currencySymbol}{formatLargeNumber(displayAmount)}
            </span>
          </div>
        );
      })}
    </div>
  );
}