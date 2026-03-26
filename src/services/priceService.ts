// src/services/priceServices.ts
import { queryCryptoCCXT } from "@/app/api/data-sources/crypto-ccxt";
import { searchStockOrETF } from "./stockService";
import { searchFund } from "./fundService";
import { queryJuheGold } from "@/app/api/data-sources/juhe-gold";

type AssetType = 'stock' | 'etf' | 'crypto' | 'fund' | 'metal';

interface PriceResult {
  price: number;
  changePercent: number;
  currency: string;
  source: string;
}

export async function fetchPriceForAsset(asset: {
  symbol: string;
  type: AssetType;
}): Promise<PriceResult | null> {
  const { symbol, type } = asset;

  try {
    if (type === 'crypto') {
      const result = await queryCryptoCCXT(symbol);
      // 确保 price 是有效的数字
      if (result.success && result.data && typeof result.data.price === 'number' && !isNaN(result.data.price)) {
        return {
          price: result.data.price,
          changePercent: result.data.changePercent ?? 0, // 处理 null/undefined
          currency: result.data.currency,
          source: result.source,
        };
      }
    } else if (type === 'stock' || type === 'etf') {
      let symbolToSearch = symbol;
      if (/^\d{6}$/.test(symbol)) {
        symbolToSearch = `${symbol}.SS`; // 简单处理 A 股，searchStockOrETF 内部会进一步规范化
      }
      const result = await searchStockOrETF(symbolToSearch);
      if (result && result.success && result.data && typeof result.data.price === 'number' && !isNaN(result.data.price)) {
        return {
          price: result.data.price,
          changePercent: result.data.changePercent ?? 0,
          currency: result.data.currency,
          source: result.source,
        };
      }
    } else if (type === 'fund') {
      const result = await searchFund(symbol);
      if (result.success && result.data && typeof result.data.price === 'number' && !isNaN(result.data.price)) {
        return {
          price: result.data.price,
          changePercent: result.data.changePercent ?? 0,
          currency: result.data.currency,
          source: result.source,
        };
      }
    } else if (type === 'metal') {
      const result = await queryJuheGold(symbol);
      if (result.success && result.data && typeof result.data.price === 'number' && !isNaN(result.data.price)) {
        return {
          price: result.data.price,
          changePercent: result.data.changePercent ?? 0,
          currency: result.data.currency,
          source: result.source,
        };
      }
    }
  } catch (err) {
    console.error(`获取 ${symbol} 价格失败:`, err);
  }
  return null;
}