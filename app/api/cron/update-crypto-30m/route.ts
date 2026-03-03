import { NextResponse } from 'next/server';

export const maxDuration = 60; // 最大执行时间（秒）

export async function GET() {
  const symbols = ['BTC', 'ETH', 'BNB']; // 需要更新的交易对
  const results = [];

  for (const symbol of symbols) {
    try {
      const response = await fetch(`${process.env.BASE_URL}/api/crypto/fetch-minute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          resolution: '30m',
          limit: 95,
        }),
      });
      const result = await response.json();
      results.push({ symbol, ...result });
    } catch (error) {
      results.push({ symbol, error: String(error) });
    }
    // 避免请求过频繁
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return NextResponse.json({ results });
}