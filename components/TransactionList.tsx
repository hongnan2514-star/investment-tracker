// components/TransactionList.tsx
"use client";

import React from 'react';
import Image from 'next/image';
import { Banknote } from 'lucide-react';

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
}

export default function TransactionList({ transactions, currencySymbol, emptyMessage = '暂无收支记录' }: TransactionListProps) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 dark:text-gray-500 font-medium">{emptyMessage}</p >
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">点击右下角 + 记录收支</p >
      </div>
    );
  }

  return (
    <div className="space-y-3 mb-20">
      {transactions.map(tx => (
        <div key={tx.id} className="bg-white dark:bg-[#0a0a0a] rounded-2xl p-3 shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                {tx.accountLogoUrl ? (
                  <Image src={tx.accountLogoUrl} alt={tx.accountName} width={32} height={32} className="object-contain rounded-full" />
                ) : (
                  <Banknote size={20} className="text-orange-600" />
                )}
              </div>
              <div className="flex-1">
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
            <p className={`font-bold ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
              {tx.type === 'income' ? '+' : '-'}{currencySymbol}{tx.amount.toFixed(2)}
            </p >
          </div>
          <div className="text-right text-[10px] text-gray-400 dark:text-gray-500 mt-1">
            {new Date(tx.date).toLocaleString('zh-CN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
      ))}
    </div>
  );
}