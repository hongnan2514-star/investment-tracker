// src/services/currency.ts
import { useState, useEffect } from 'react';
import { convertAmount } from './forex';
import { useCallback } from 'react';

export type CurrencyCode = 'USD' | 'CNY' | 'EUR' | 'GBP' | 'USDT';

export const currencySymbols: Record<CurrencyCode, string> = {
  USD: '$',
  CNY: '¥',
  EUR: '€',
  GBP: '£',
  USDT: '₮',
};

export const currencyNames: Record<CurrencyCode, string> = {
  USD: '美元 (USD)',
  CNY: '人民币 (CNY)',
  EUR: '欧元 (EUR)',
  GBP: '英镑 (GBP)',
  USDT: '泰达币 (USDT)',
};

const STORAGE_KEY = 'preferred_currency';

export function getStoredCurrency(): CurrencyCode {
  if (typeof window === 'undefined') return 'USD';
  const stored = localStorage.getItem(STORAGE_KEY) as CurrencyCode | null;
  return stored && stored in currencySymbols ? stored : 'USD';
}

export function setStoredCurrency(currency: CurrencyCode) {
  localStorage.setItem(STORAGE_KEY, currency);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('currency-changed'));
  }
}

export function useCurrency() {
  // 初始状态设为 'USD'，与服务端默认一致
  const [currency, setCurrency] = useState<CurrencyCode>('USD');

  useEffect(() => {
    // 客户端加载后从 localStorage 读取实际值并更新
    setCurrency(getStoredCurrency());

    const handleChange = () => {
      setCurrency(getStoredCurrency());
    };
    window.addEventListener('currency-changed', handleChange);
    return () => window.removeEventListener('currency-changed', handleChange);
  }, []);

  const updateCurrency = (newCurrency: CurrencyCode) => {
    setStoredCurrency(newCurrency);
    setCurrency(newCurrency);
  };

  return {
    currency,
    setCurrency: updateCurrency,
    symbol: currencySymbols[currency],
  };
}

/**
 * 金额转换 Hook（带加载状态）
 */
export function useCurrencyConverter() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const convert = useCallback(async (
    amount: number,
    from: CurrencyCode,
    to: CurrencyCode
  ): Promise<number> => {
    if (from === to) return amount;
    setLoading(true);
    setError(null);
    try {
      const result = await convertAmount(amount, from, to);
      return result;
    } catch (err) {
      setError('汇率转换失败，使用备用汇率');
      // 备用汇率
      if (from === 'USD' && to === 'CNY') return amount * 7.2;
      if (from === 'USD' && to === 'EUR') return amount * 0.85;
      if (from === 'USD' && to === 'GBP') return amount * 0.75;
      return amount;
    } finally {
      setLoading(false);
    }
  }, []); // 空依赖，因为 convertAmount 是纯函数，不会变化

  return { convert, loading, error };
}