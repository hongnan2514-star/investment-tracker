import { NextRequest, NextResponse } from "next/server";
import { queryAlphaVantage } from "@/app/api/data-sources/alpha-vantage";
import { queryYahooFinance } from "../data-sources/yahoo-finance";
// 导入 Finnhub（主要股票源）
import { queryFinnhub } from "@/app/api/data-sources/finnhub";
import { searchFund } from "@/src/services/fundService";
import { DataSourceResult } from "@/app/api/data-sources/types";
import { queryCryptoCCXT } from "@/app/api/data-sources/crypto-ccxt";
import { searchGovRealEstate } from "@/app/api/data-sources/gov-realestate";
import { queryITick, queryITickMetal } from "@/app/api/data-sources/itick";

// A股代码规范化函数（与前端保持一致）
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

/**
 * 搜索股票或ETF（优先使用 Finnhub，降级到 Yahoo/Alpha Vantage）
 */
async function searchStockOrETF(symbol: string): Promise<DataSourceResult | null> {
  // 1. 先尝试 Finnhub（主要源）
  const finnhubResult = await queryFinnhub(symbol);
  if (finnhubResult.success && finnhubResult.data) return finnhubResult;

  // 2. Finnhub 失败后，尝试 Yahoo Finance
  const yahooResult = await queryYahooFinance(symbol);
  if (yahooResult.success && yahooResult.data) return yahooResult;

  // 3. 最后尝试 Alpha Vantage
  const avResult = await queryAlphaVantage(symbol);
  if (avResult.success && avResult.data) return avResult;

  return null;
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol');
  const type = request.nextUrl.searchParams.get('type');

  if (!symbol) {
    return NextResponse.json({ error: '缺少代码参数' }, { status: 400 });
  }

  const trimmedSymbol = symbol.trim();

  try {
    // 根据类型分派搜索
    if (type === 'stock' || type === 'etf') {
      let symbolToSearch = trimmedSymbol;
      if (/^\d{6}$/.test(trimmedSymbol)) {
        symbolToSearch = normalizeAStockSymbol(trimmedSymbol);
        console.log(`[搜索路由] 股票/ETF 将6位数字代码规范化为: ${symbolToSearch}`);
      }
      const result = await searchStockOrETF(symbolToSearch);
      if (result) {
        return NextResponse.json({
          success: true,
          ...result.data,
          source: result.source
        });
      }
    } else if (type === 'fund') {
      const result = await searchFund(trimmedSymbol);
      if (result.success) {
        return NextResponse.json({
          success: true,
          ...result.data,
          source: result.source
        });
      }
    } else if (type === 'crypto') {
      console.log(`[搜索路由] 开始搜索加密货币: ${trimmedSymbol}`);
      const cryptoResult = await queryCryptoCCXT(trimmedSymbol);
      if (cryptoResult.success) {
        return NextResponse.json({
          success: true,
          ...cryptoResult.data,
          source: cryptoResult.source
        });
      } else {
        return NextResponse.json(
          { error: cryptoResult.error || '加密货币搜索失败' },
          { status: 404 }
        );
      }
    } else if (type === 'metal') {
    console.log(`[搜索路由] 开始搜索贵金属: ${trimmedSymbol}`);
    const result = await queryITickMetal(trimmedSymbol);
    if (result.success) {
        return NextResponse.json({
            success: true,
            ...result.data,
            source: result.source
        });
    } else {
        return NextResponse.json(
            { error: result.error || '贵金属搜索失败' },
            { status: 404 }
        );
      }
    } else if (type === 'real_estate') {
      console.log(`[搜索路由] 开始搜索房产: ${trimmedSymbol}`);
      const result = await searchGovRealEstate(trimmedSymbol);
      if (result.success) {
        return NextResponse.json({
          success: true,
          ...result.data,
          source: result.source
        });
      } else {
        return NextResponse.json(
          { error: result.error || '房产搜索失败' },
          { status: 404 }
        );
      }
    } else {
      // 兼容旧版本：未传递type时，按原有逻辑（先基金后股票），然后尝试加密货币（不包含房产）
      console.log(`[搜索路由] 未指定类型，使用兼容模式搜索: ${trimmedSymbol}`);
      // 先试基金（6位数字）
      if (/^\d{6}$/.test(trimmedSymbol)) {
        const fundResult = await searchFund(trimmedSymbol);
        if (fundResult.success) {
          return NextResponse.json({
            success: true,
            ...fundResult.data,
            source: fundResult.source
          });
        }
      }
      // 再试股票
      let symbolToSearch = trimmedSymbol;
      if (/^\d{6}$/.test(trimmedSymbol)) {
        symbolToSearch = normalizeAStockSymbol(trimmedSymbol);
      }
      const stockResult = await searchStockOrETF(symbolToSearch);
      if (stockResult) {
        return NextResponse.json({
          success: true,
          ...stockResult.data,
          source: stockResult.source
        });
      }
      // 最后尝试加密货币（如果前面都失败）
      const cryptoResult = await queryCryptoCCXT(trimmedSymbol);
      if (cryptoResult.success) {
        return NextResponse.json({
          success: true,
          ...cryptoResult.data,
          source: cryptoResult.source
        });
      }
    }

    // 所有尝试均失败
    return NextResponse.json(
      {
        error: `未找到代码 "${trimmedSymbol}" 对应的资产`,
        suggestion: type ? `请确认代码格式正确` : '可尝试指定资产类型'
      },
      { status: 404 }
    );

  } catch (error) {
    console.error('[搜索路由] 服务器内部错误:', error);
    return NextResponse.json(
      { error: '服务器内部错误，请稍后重试' },
      { status: 500 }
    );
  }
}