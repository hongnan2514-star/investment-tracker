import { NextRequest, NextResponse } from 'next/server';
import { getFundHistory } from '@/src/services/fundHistoryDB'; // 基金历史（从本地数据库）
import { queryFinnhub } from '@/app/api/data-sources/finnhub'; // 用于股票历史（需调整）

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol');
  const type = request.nextUrl.searchParams.get('type');

  if (!symbol || !type) {
    return NextResponse.json({ error: '缺少参数' }, { status: 400 });
  }

  try {
    let history: { date: string; value: number }[] = [];

    if (type === 'fund') {
      // 基金：从本地数据库获取最近一年数据
      const fundHistory = getFundHistory(symbol, 365); // 假设返回 FundNav[]
      history = fundHistory.map(item => ({ date: item.date, value: item.nav }));
    } else if (type === 'stock' || type === 'etf') {
      // 股票/ETF：调用 Finnhub 获取一年日线数据
      // Finnhub 的 /stock/candle 接口需要 from/to 时间戳
      const to = Math.floor(Date.now() / 1000);
      const from = to - 365 * 24 * 60 * 60; // 一年前
      const res = await fetch(
        `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${to}&token=${process.env.FINNHUB_API_KEY}`
      );
      const data = await res.json();
      if (data.s === 'ok') {
        // data.t 是时间戳数组，data.c 是收盘价
        history = data.t.map((timestamp: number, index: number) => ({
          date: new Date(timestamp * 1000).toISOString().split('T')[0],
          value: data.c[index],
        }));
      }
    } else if (type === 'crypto') {
      // 加密货币：使用 CCXT 获取历史（需要选择一个交易所，如 binance）
      // 这里简单返回空数组，可根据需要实现
      history = [];
    } else {
      // 其他类型暂不支持历史
      history = [];
    }

    return NextResponse.json({ success: true, data: history });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}