// app/api/history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getFundHistory } from '@/src/services/fundHistoryDB'; // 基金历史（从本地数据库）
import { queryFinnhub } from '@/app/api/data-sources/finnhub'; // 用于股票历史（需调整）
import { getCryptoHistory, saveCryptoHistory, needsCryptoUpdate } from '@/src/services/fundHistoryDB';
import { queryCryptoOHLCV } from '@/app/api/data-sources/crypto-ccxt';

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol');
  const type = request.nextUrl.searchParams.get('type');
  const range = request.nextUrl.searchParams.get('range') || '1d';  // 默认日线
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '365');

  if (!symbol || !type) {
    return NextResponse.json({ error: '缺少参数' }, { status: 400 });
  }

  try {
    let history: { date: string; value: number }[] = [];

    if (type === 'fund') {
      if (range === '1d'){
      // 基金：从本地数据库获取最近一年数据
      const fundHistory = getFundHistory(symbol, limit); // 假设返回 FundNav[]
      history = fundHistory.map(item => ({ date: item.date, value: item.nav }));
      } else {
      history = []      
    }
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
    }  else if (type === 'crypto') {
  const resolution = range;
  if (['5m', '15m', '30m', '1h'].includes(resolution)) {
    const baseSymbol = symbol.split('/')[0]; // 从 "BTC/USDT" 获取 "BTC"
    const minuteData = await queryCryptoOHLCV(baseSymbol, resolution, limit);
    // 更健壮的判断：确保 minuteData 是数组
    if (minuteData && Array.isArray(minuteData)) {
      history = minuteData
        .sort((a, b) => a.timestamp - b.timestamp)
        .map(item => ({
          date: new Date(item.timestamp * 1000).toISOString(),
          value: item.close,
        }));
    } else {
      console.warn(`[Crypto] 无法获取 ${symbol} 的 ${resolution} 数据`);
      history = [];
    }
  } else {
    const cryptoHistory = getCryptoHistory(symbol, limit);
    history = cryptoHistory.map(item => ({ date: item.date, value: item.close }));
  }
} else {
      history = [];
    }

    return NextResponse.json({ success: true, data: history });
  } catch (error: any) {
    console.error('[历史API] 错误:', error);
    return NextResponse.json({ success: false, data: [], error: error.message });
  }
}