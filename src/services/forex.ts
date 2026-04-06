// src/services/forex.ts
import { CurrencyCode } from './currency';

let ratesCache: Record<string, number> | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 60 * 60 * 1000;

// 判断是否为浏览器环境
const isBrowser = typeof window !== 'undefined';

// 获取基础 URL（用于服务端调用自身 API）
function getBaseUrl() {
  if (isBrowser) return ''; // 浏览器端使用相对路径
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT || 3000}`;
}

export async function getExchangeRates(): Promise<Record<string, number>> {
  const now = Date.now();

  if (ratesCache && now - lastFetchTime < CACHE_TTL) {
    console.log('[forex] 使用缓存汇率');
    return ratesCache;
  }

  try {
    let rates: Record<string, number>;

    if (isBrowser) {
      // 浏览器端：通过代理 API 获取（避免 CORS）
      console.log('[forex] 浏览器端从代理 API 获取汇率...');
      const response = await fetch('/api/forex');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      rates = await response.json();
    } else {
      // 服务端：直接请求 Frankfurter API（无 CORS 限制）
      console.log('[forex] 服务端直接从 Frankfurter 获取汇率...');
      const response = await fetch('https://api.frankfurter.app/latest?from=USD');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      rates = {
        USD: 1,
        CNY: data.rates.CNY || 7.2,
        EUR: data.rates.EUR || 0.85,
        GBP: data.rates.GBP || 0.75,
        USDT: 1,
        HKD: data.rates.HKD || 7.8,
      };
    }

    console.log('[forex] 获取到汇率:', rates);
    ratesCache = rates;
    lastFetchTime = now;
    return rates;
  } catch (error) {
    console.error('[forex] 汇率获取失败，使用备用固定汇率:', error);
    return getFixedRates();
  }
}

function getFixedRates(): Record<string, number> {
  return {
    USD: 1,
    CNY: 7.2,
    EUR: 0.85,
    GBP: 0.75,
    USDT: 1,
    HKD: 7.8,
  };
}

export async function convertAmount(
  amount: number,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode
): Promise<number> {
  if (fromCurrency === toCurrency) return amount;
  const rates = await getExchangeRates();
  const amountInUSD = fromCurrency === 'USD' ? amount : amount / rates[fromCurrency];
  const result = amountInUSD * rates[toCurrency];
  return Math.round(result * 100) / 100;
}