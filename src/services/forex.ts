// src/services/forex.ts
import { CurrencyCode } from './currency';

// 使用 exchangerate-api.com 免费版，无需密钥
const API_URL = 'https://api.exchangerate-api.com/v4/latest/USD';

// 汇率缓存
let ratesCache: Record<string, number> | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1小时缓存，确保不超免费额度

/**
 * 获取以USD为基准的汇率
 */
export async function getExchangeRates(): Promise<Record<string, number>> {
  const now = Date.now();

  // 缓存有效则直接返回
  if (ratesCache && (now - lastFetchTime) < CACHE_TTL) {
    return ratesCache;
  }

  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`汇率API请求失败: ${response.status}`);
    }
    const data = await response.json();
    
    // API 返回格式: { rates: { CNY: 7.2, EUR: 0.85, GBP: 0.75, ... } }
    const rates = data.rates;
    
    // 构建支持我们需要的货币的汇率映射
    const result: Record<string, number> = {
      USD: 1,
      CNY: rates.CNY || 7.2,
      EUR: rates.EUR || 0.85,
      GBP: rates.GBP || 0.75,
      USDT: 1, // USDT 视为与USD 1:1
    };

    ratesCache = result;
    lastFetchTime = now;
    return result;

  } catch (error) {
    console.error('汇率获取失败，使用备用汇率:', error);
    return getFallbackRates();
  }
}

/**
 * 备用汇率（当API失败时使用）
 */
function getFallbackRates(): Record<string, number> {
  return {
    USD: 1,
    CNY: 7.2,
    EUR: 0.85,
    GBP: 0.75,
    USDT: 1,
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
  
  // 先转换为USD（基准货币）
  const amountInUSD = fromCurrency === 'USD' ? amount : amount / rates[fromCurrency];
  // 再从USD转换为目标货币
  const result = amountInUSD * rates[toCurrency];
  
  return result;
}