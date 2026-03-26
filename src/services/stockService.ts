// src/services/stockService.ts
import { queryFinnhub } from "@/app/api/data-sources/finnhub";
import { queryYahooFinance } from "@/app/api/data-sources/yahoo-finance";
import { DataSourceResult } from "@/app/api/data-sources/types";

// 内存缓存（1分钟）
interface CacheEntry {
  data: DataSourceResult;
  timestamp: number;
}
const stockCache = new Map<string, CacheEntry>();
const CACHE_TTL = 60 * 1000;

// A股代码规范化
function normalizeAStockSymbol(symbol: string): string {
  const trimmed = symbol.trim();
  if (/^[0-9]{6}$/.test(trimmed)) {
    if (trimmed.startsWith('6') || trimmed.startsWith('5')) {
      return `${trimmed}.SS`;
    } else if (trimmed.startsWith('0') || trimmed.startsWith('3') || trimmed.startsWith('1')) {
      return `${trimmed}.SZ`;
    }
  }
  return trimmed;
}

export async function searchStockOrETF(symbol: string): Promise<DataSourceResult | null> {
  // 检查缓存
  const cached = stockCache.get(symbol);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const symbolsToTry = [symbol];
  // 如果是纯数字，尝试港股后缀
  if (/^\d+$/.test(symbol) && symbol.length >= 4 && symbol.length <= 5) {
    symbolsToTry.push(`${symbol}.HK`);
  }

  for (const trySymbol of symbolsToTry) {
    // 先尝试 Finnhub
    const finnhubResult = await queryFinnhub(trySymbol);
    if (finnhubResult.success && finnhubResult.data) {
      stockCache.set(symbol, { data: finnhubResult, timestamp: Date.now() });
      return finnhubResult;
    }

    // 再尝试 Yahoo
    const yahooResult = await queryYahooFinance(trySymbol);
    if (yahooResult.success && yahooResult.data) {
      stockCache.set(symbol, { data: yahooResult, timestamp: Date.now() });
      return yahooResult;
    }
  }
  return null;
}