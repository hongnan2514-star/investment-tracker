// components/TransactionList.tsx
"use client";

import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { getCategoryIcon } from './CategorySelector';

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
}

export default function TransactionList({ transactions, currencySymbol, emptyMessage = '暂无收支记录', onTransactionClick }: TransactionListProps) {
  const router = useRouter();

  const handleClick = (tx: Transaction) => {
    if (onTransactionClick) {
      onTransactionClick(tx.accountSymbol);
    } else {
      router.push(`/ledger/account/${encodeURIComponent(tx.accountSymbol)}`);
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

  // 格式化日期（年月日）
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  };

  return (
    <div className="space-y-3 mb-20">
      {transactions.map(tx => (
        <div key={tx.id}>
          {/* 时间显示在卡片外部左上方，只显示年月日 */}
          <div className="text-left text-xs text-gray-400 dark:text-gray-500 mb-1 ml-1">
            {formatDate(tx.date)}
          </div>
          {/* 卡片 */}
          <div
            onClick={() => handleClick(tx)}
            className="bg-white dark:bg-[#0a0a0a] rounded-2xl p-3 shadow-sm border border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
          >
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3 flex-1 min-w-0">
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
                    <Image
                      src={tx.accountLogoUrl}
                      alt={tx.accountName}
                      width={16}
                      height={16}
                      className="object-contain rounded-full opacity-70"
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