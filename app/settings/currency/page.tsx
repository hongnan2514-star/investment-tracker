// app/settings/currency/page.tsx
'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { currencyNames, useCurrency, CurrencyCode } from '@/src/services/currency';
import { useUser } from '@/src/hooks/useUser';

export default function CurrencyPage() {
  const router = useRouter();
  const { currency, setCurrency } = useCurrency();
  const { user, updateUser } = useUser();

  const handleSelect = async (code: CurrencyCode) => {
    setCurrency(code);
    if (user) {
      await updateUser({ preferredCurrency: code });
    }
    router.back();
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
      </header>

      <div className="bg-gray-50 dark:bg-black rounded-3xl p-2 ">
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
              {/* 国旗图标，保持原始比例 */}
              <img
                src={`/flags/${code}.png/`}
                alt={code}
                className="w-6 h-auto object-contain"  // 宽度固定，高度自适应，保持比例
                onError={(e) => (e.currentTarget.style.display = 'none')} // 图片加载失败时隐藏
              />
              <span className="text-gray-700 dark:text-gray-300">{currencyNames[code]}</span>
            </div>
            {currency === code && (
              <span className="text-blue-600 dark:text-blue-400">✓</span>
            )}
          </button>
        ))}
      </div>
    </main>
  );
}