import { NextRequest, NextResponse } from "next/server";
import { queryAlphaVantage } from "@/app/api/data-sources/alpha-vantage";
import { queryYahooFinance } from "../data-sources/yahoo-finance";
import { queryTushareFund } from "../data-sources/tushare"; // 导入新的基金查询函数
import { DataSourceResult } from "@/app/api/data-sources/types";
import { queryAKShareFund } from "../data-sources/akshare"; 

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

// 新增：A股代码规范化函数（与前端保持一致）
function normalizeAStockSymbol(symbol: string): string {
  const trimmed = symbol.trim();
  if (/^[0-9]{6}$/.test(trimmed)) {
    if (trimmed.startsWith('6') || trimmed.startsWith('5')) {
      return `${trimmed}.SS`; // 上海证券交易所
    } else if (trimmed.startsWith('0') || trimmed.startsWith('3') || trimmed.startsWith('1')) {
      return `${trimmed}.SZ`; // 深圳证券交易所
    }
  }
  return trimmed;
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol');
  if (!symbol) {
    return NextResponse.json(
      { error: '缺少代码参数' },
      { status: 400 }
    );
  }

  const trimmedSymbol = symbol.trim();

  try {
    // --- 策略1：优先识别并查询场外基金 ---
    // 中国场外基金代码通常是6位纯数字，如 017174, 000001
    if (/^\d{6}$/.test(trimmedSymbol)) {
      console.log(`[搜索路由] 识别为6位数字代码，优先尝试Tushare基金查询: ${trimmedSymbol}`);
      
      const fundResult = await queryTushareFund(trimmedSymbol);
      if (fundResult.success && fundResult.data) {
        console.log(`[搜索路由] Tushare基金查询成功: ${fundResult.data.name}`);
        return NextResponse.json({
          success: true,
          ...fundResult.data,
          source: fundResult.source || 'Tushare基金'
        });
      }
      // 如果基金查询失败，继续尝试股票查询（将6位数字规范化为A股代码）
      console.log(`[搜索路由] Tushare基金查询失败,尝试作为AKShare查询: ${trimmedSymbol}`);
      const akFundResult = await queryAKShareFund(trimmedSymbol);
      if (akFundResult.success && akFundResult.data) {
        console.log(`[搜索路由] AKShare查询成功: ${akFundResult.data.name}`);
        return NextResponse.json({
          success: true,
          ...akFundResult.data,
          source: akFundResult.source || 'AKShare'
        });
      }
    }

    // --- 策略2：查询A股/美股/港股等证券 ---
    // 2.1 优先尝试Yahoo Finance（覆盖A股、美股、港股等）

    console.log(`[搜索路由] 尝试Yahoo Finance查询: ${trimmedSymbol}`);
    
    // 关键修改：对于6位数字代码，先进行A股代码规范化
    let symbolToSearch = trimmedSymbol;
    if (/^\d{6}$/.test(trimmedSymbol)) {
      symbolToSearch = normalizeAStockSymbol(trimmedSymbol);
      console.log(`[搜索路由] 将6位数字代码规范化为: ${symbolToSearch}`);
    }
    
    const yahooResult = await queryYahooFinance(symbolToSearch);
    if (yahooResult.success && yahooResult.data) {
      console.log(`[搜索路由] Yahoo Finance查询成功: ${yahooResult.data.name}`);
      return NextResponse.json({
        success: true,
        ...yahooResult.data,
        source: yahooResult.source || 'Yahoo Finance'
      });
    }

    // 2.2 后备尝试Alpha Vantage（主要美股）
    console.log(`[搜索路由] 尝试Alpha Vantage查询: ${trimmedSymbol}`);
    const avResult = await queryAlphaVantage(trimmedSymbol);
    if (avResult.success && avResult.data) {
      console.log(`[搜索路由] Alpha Vantage查询成功: ${avResult.data.name}`);
      return NextResponse.json({
        success: true,
        ...avResult.data,
        source: avResult.source || 'Alpha Vantage'
      });
    }

    // --- 所有数据源均失败 ---
    console.log(`[搜索路由] 所有数据源均未找到代码: ${trimmedSymbol}`);
    return NextResponse.json(
      { 
        error: `未找到代码 "${trimmedSymbol}" 对应的资产`,
        suggestion: /^\d{6}$/.test(trimmedSymbol) 
          ? '该代码不符合已知的基金或股票格式。' 
          : '请检查代码格式是否正确（如AAPL、600519.SS、00700.HK）。'
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
        