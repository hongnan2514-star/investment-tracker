// components/TransactionList.tsx
"use client";

import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Circle, CheckCircle } from 'lucide-react';
import { getCategoryIcon } from './CategorySelector';
import { useTheme } from '@/app/ThemeProvider';

type Transaction = {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  note: string;
  date: string;
  accountSymbol: string;
  accountName: string;
  accountLogoUrl?: string;
  accountBalanceAfter: number;
};

interface TransactionListProps {
  transactions: Transaction[];
  currencySymbol: string;
  emptyMessage?: string;
  onTransactionClick?: (accountSymbol: string) => void;
  isSelectMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

const getIconPath = (logoUrl: string | undefined, theme: string) => {
  if (!logoUrl) return null;
  if (logoUrl.startsWith('http')) return logoUrl;
  let fileName = logoUrl.split('/').pop() || logoUrl;
  fileName = fileName.split('?')[0];
  const key = fileName.replace(/_(light|dark)\.png$/, '').replace(/\.png$/, '');
  const suffix = theme === 'dark' ? 'dark' : 'light';
  return `/icons/payment/${key}_${suffix}.png`;
};

export default function TransactionList({
  transactions,
  currencySymbol,
  emptyMessage = '暂无收支记录',
  onTransactionClick,
  isSelectMode = false,
  selectedIds = new Set(),
  onToggleSelect,
}: TransactionListProps) {
  const router = useRouter();
  const { theme } = useTheme();

  const handleCardClick = (tx: Transaction) => {
    if (isSelectMode && onToggleSelect) {
      onToggleSelect(tx.id);
    } else {
      if (onTransactionClick) {
        onTransactionClick(tx.accountSymbol);
      } else {
        router.push(`/ledger/account/${encodeURIComponent(tx.accountSymbol)}`);
      }
    }
  };

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 dark:text-gray-500 font-medium">{emptyMessage}</p >
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">点击右下角 + 记录收支</p >
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  };

  return (
    <div className="space-y-3 mb-20">
      {transactions.map(tx => (
        <div key={tx.id}>
          <div className="text-left text-xs text-gray-400 dark:text-gray-500 mb-1 ml-1">
            {formatDate(tx.date)}
          </div>
          <div
            onClick={() => handleCardClick(tx)}
            className="bg-white dark:bg-[#0a0a0a] rounded-2xl p-3 shadow-sm border border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
          >
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* 选择模式下的复选框 */}
                {isSelectMode && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSelect?.(tx.id);
                    }}
                    className="flex-shrink-0"
                  >
                    {selectedIds.has(tx.id) ? (
                      <CheckCircle size={20} className="text-orange-500" />
                    ) : (
                      <Circle size={20} className="text-gray-400" />
                    )}
                  </button>
                )}
                <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                  {getCategoryIcon(tx.type, tx.category)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-x-2">
                    <span className="font-bold text-gray-900 dark:text-gray-100">{tx.category}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{tx.accountName}</span>
                  </div>
                  {tx.note && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{tx.note}</p >}
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                    余额 {currencySymbol}{tx.accountBalanceAfter.toFixed(2)}
                  </p >
                </div>
              </div>
              <div className="flex flex-col items-end flex-shrink-0 ml-2">
                <p className="font-bold text-gray-900 dark:text-gray-100">
                  {tx.type === 'income' ? '+' : '-'}{tx.amount.toFixed(2)}
                </p >
                {tx.accountLogoUrl && (
                  <div className="mt-1">
                     <img
                    src={getIconPath(tx.accountLogoUrl, theme) || ''}
                    alt={tx.accountName}
                    className="w-4 h-4 object-contain rounded-full opacity-70"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}