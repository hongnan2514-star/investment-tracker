// app/settings/currency/page.tsx
'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { currencyNames, currencySymbols, useCurrency, CurrencyCode } from '@/src/services/currency';

export default function CurrencyPage() {
  const router = useRouter();
  const { currency, setCurrency } = useCurrency();

  const handleSelect = (code: CurrencyCode) => {
    setCurrency(code);
    router.back(); // 返回上一页
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-black p-4">
      <header className="mb-6 flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition"
        >
          <ChevronLeft size={24} className="text-gray-600 dark:text-gray-300" />
        </button>
        <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">选择计价货币</h1>
      </header>

      <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl p-2 shadow-md">
        {(Object.keys(currencyNames) as CurrencyCode[]).map((code) => (
          <button
            key={code}
            onClick={() => handleSelect(code)}
            className={`w-full flex items-center justify-between p-4 rounded-xl transition ${
              currency === code
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                : 'hover:bg-gray-50 dark:hover:bg-[#1a1a1a]'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold">{currencySymbols[code]}</span>
              <span className="text-gray-700 dark:text-gray-300">{currencyNames[code]}</span>
            </div>
            {currency === code && (
              <span className="text-blue-600 dark:text-blue-400">✓</span>
            )}
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
        * 当前版本仅切换货币符号，数值不进行汇率换算
      </p >
    </main>
  );
}