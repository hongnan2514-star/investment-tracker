// app/api/history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getFundHistory } from '@/src/services/fundHistoryDB';
import { queryFinnhub } from '@/app/api/data-sources/finnhub';
import { getCryptoHistory, saveCryptoHistory, needsCryptoUpdate } from '@/src/services/fundHistoryDB';
import { queryCryptoOHLCV } from '@/app/api/data-sources/crypto-ccxt';

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol');
  const type = request.nextUrl.searchParams.get('type');
  const range = request.nextUrl.searchParams.get('range') || '1d';
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '365');

  if (!symbol || !type) {
    return NextResponse.json({ error: '缺少参数' }, { status: 400 });
  }

  try {
    let history: { date: string; value: number }[] = [];

    if (type === 'fund') {
      if (range === '1d') {
        const fundHistory = await getFundHistory(symbol, limit); // ✅ 异步调用
        history = fundHistory.map(item => ({ date: item.date, value: item.nav }));
      } else {
        history = [];
      }
    } else if (type === 'stock' || type === 'etf') {
      const to = Math.floor(Date.now() / 1000);
      const from = to - 365 * 24 * 60 * 60;
      const res = await fetch(
        `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${to}&token=${process.env.FINNHUB_API_KEY}`
      );
      const data = await res.json();
      if (data.s === 'ok') {
        history = data.t.map((timestamp: number, index: number) => ({
          date: new Date(timestamp * 1000).toISOString().split('T')[0],
          value: data.c[index],
        }));
      }
    } else if (type === 'crypto') {
      const resolution = range;
      const baseSymbol = symbol.split('/')[0];
      const ohlcvData = await queryCryptoOHLCV(baseSymbol, resolution, limit);
      if (ohlcvData && Array.isArray(ohlcvData)) {
        history = ohlcvData.map(item => ({
          date: new Date(item.timestamp * 1000).toISOString(),
          value: item.close,
        }));
      } else {
        history = [];
      }
    }

    return NextResponse.json({ success: true, data: history });
  } catch (error: any) {
    console.error('[历史API] 错误:', error);
    return NextResponse.json({ success: false, data: [], error: error.message });
  }
}