// src/services/forex.ts
import { CurrencyCode } from './currency';

// 使用 Frankfurter 作为主要源（无需密钥）
const API_URL = 'https://api.frankfurter.app/latest?from=USD';

// 汇率缓存
let ratesCache: Record<string, number> | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1小时缓存

export async function getExchangeRates(): Promise<Record<string, number>> {
  const now = Date.now();

  if (ratesCache && (now - lastFetchTime) < CACHE_TTL) {
    console.log('[forex] 使用缓存汇率');
    return ratesCache;
  }

  try {
    console.log('[forex] 正在从 Frankfurter 获取汇率...');
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    // Frankfurter 返回格式：{ rates: { CNY: 7.2, EUR: 0.85, ... } }
    const rates = data.rates;

    // 确保包含所有支持货币，缺失时使用备用值
    const result: Record<string, number> = {
      USD: 1,
      CNY: rates.CNY || 7.2,
      EUR: rates.EUR || 0.85,
      GBP: rates.GBP || 0.75,
      USDT: 1, // USDT 视为 1:1 锚定 USD
      HKD: rates.HKD || 7.8
    };

    console.log('[forex] 获取到汇率:', result);
    ratesCache = result;
    lastFetchTime = now;
    return result;
  } catch (error) {
    console.error('[forex] 汇率获取失败，使用备用汇率:', error);
    return getFallbackRates();
  }
}

function getFallbackRates(): Record<string, number> {
  console.warn('[forex] 使用备用固定汇率');
  return {
    USD: 1,
    CNY: 7.2,
    EUR: 0.85,
    GBP: 0.75,
    USDT: 1,
    HKD: 7.8,
  };
}

/**
 * 货币转换函数
 * @param amount 金额
 * @param fromCurrency 源货币
 * @param toCurrency 目标货币
 */
export async function convertAmount(
  amount: number,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode
): Promise<number> {
  if (fromCurrency === toCurrency) return amount;

  const rates = await getExchangeRates();

  // 以 USD 为中间货币转换
  const amountInUSD = fromCurrency === 'USD' ? amount : amount / rates[fromCurrency];
  const result = amountInUSD * rates[toCurrency];

  // 保留两位小数
  return Math.round(result * 100) / 100;
}