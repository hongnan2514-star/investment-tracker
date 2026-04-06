// app/api/forex/route.ts
import { NextResponse } from 'next/server';

const FRANKFURTER_API = 'https://api.frankfurter.app/latest?from=USD';

export async function GET() {
  try {
    const response = await fetch(FRANKFURTER_API, {
      // 设置超时，避免长时间等待
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Frankfurter API responded with status ${response.status}`);
    }

    const data = await response.json();
    const rates = data.rates;

    // 返回与之前格式一致的汇率数据
    const result = {
      USD: 1,
      CNY: rates.CNY || 7.2,
      EUR: rates.EUR || 0.85,
      GBP: rates.GBP || 0.75,
      USDT: 1,
      HKD: rates.HKD || 7.8,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Forex Proxy] 获取汇率失败:', error);
    // 失败时返回固定汇率，确保前端不崩溃
    return NextResponse.json({
      USD: 1,
      CNY: 7.2,
      EUR: 0.85,
      GBP: 0.75,
      USDT: 1,
      HKD: 7.8,
    });
  }
}