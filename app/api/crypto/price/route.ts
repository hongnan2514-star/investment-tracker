import { NextRequest, NextResponse } from 'next/server';
import { queryCryptoCCXT } from '@/app/api/data-sources/crypto-ccxt';

// 简单的内存缓存
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30 * 1000; // 30秒

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol');
  if (!symbol) {
    return NextResponse.json({ error: 'Missing symbol' }, { status: 400 });
  }

  // 检查缓存
  const cached = cache.get(symbol);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    const baseSymbol = symbol.split('/')[0];
    const result = await queryCryptoCCXT(baseSymbol);

    if (result.success && result.data) {
      const responseData = {
        lastPrice: result.data.price,
        priceChangePercent: result.data.changePercent || 0,
      };
      cache.set(symbol, { data: responseData, timestamp: Date.now() });
      return NextResponse.json(responseData);
    } else {
      console.error('Crypto price fetch failed:', result.error);
      return NextResponse.json({ error: result.error || 'Failed to fetch' }, { status: 500 });
    }
  } catch (error) {
    console.error('Crypto price API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}