// app/api/snapshot/history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { convertAmount } from '@/src/services/forex';
import { CurrencyCode } from '@/src/services/currency';

const sql = neon(process.env.POSTGRES_URL!);

async function getAssetHistoryWithCurrency(
  symbol: string,
  type: string,
  startDate: string,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
  baseUrl: string
): Promise<Map<string, number>> {
  const url = new URL('/api/history', baseUrl);
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('type', type);
  url.searchParams.set('range', 'since_holding');
  url.searchParams.set('startDate', startDate);
  url.searchParams.set('internal', 'true');
  try {
    const res = await fetch(url.toString());
    if (!res.ok) {
      console.error(`获取历史数据失败: ${symbol}, status: ${res.status}`);
      return new Map();
    }
    const json = await res.json();
    if (!json.success) return new Map();
    const history = json.data as { date: string; value: number }[];
    const map = new Map<string, number>();
    for (const point of history) {
      const dateStr = point.date.split('T')[0];
      let price = point.value;
      try {
        price = await convertAmount(price, fromCurrency, toCurrency);
      } catch (convErr) {
        console.warn(`汇率转换失败 ${symbol} ${fromCurrency}->${toCurrency}:`, convErr);
      }
      map.set(dateStr, price);
    }
    return map;
  } catch (error) {
    console.error(`获取资产历史数据异常 ${symbol}:`, error);
    return new Map();
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, period, targetCurrency, assets } = await request.json();
    if (!userId || !period) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const baseUrl = request.nextUrl.origin;

    if (period === '1D') {
      const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const startStr = startTime.toISOString();

      // 查询快照，直接返回时间戳（毫秒）
      const snapshots = await sql`
        SELECT EXTRACT(EPOCH FROM snapshot_time) * 1000 as timestamp, net_worth FROM snapshots
        WHERE user_id = ${userId} AND snapshot_time >= ${startStr}
        ORDER BY snapshot_time ASC
      `;

      const results = await Promise.all(snapshots.map(async (s) => {
        let value = s.net_worth;
        try {
          value = await convertAmount(value, 'CNY', targetCurrency as CurrencyCode);
        } catch (err) {
          console.warn(`1D 快照汇率转换失败: ${err}`);
        }
        return {
          timestamp: s.timestamp,
          value,
        };
      }));
      return NextResponse.json({ data: results });
    }

    // 其他周期（1W, 1M, 6M）处理保持不变，但同样使用时间戳
    let daysAgo: number;
    switch (period) {
      case '1W': daysAgo = 7; break;
      case '1M': daysAgo = 30; break;
      case '6M': daysAgo = 180; break;
      default: daysAgo = 30;
    }
    const startDateObj = new Date();
    startDateObj.setDate(startDateObj.getDate() - daysAgo);
    const startStr = startDateObj.toISOString().split('T')[0];

    if (!assets || assets.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const assetHistories = await Promise.all(assets.map(async (asset: any) => {
  const buyDate = asset.purchaseDate || startStr;
  const start = new Date(Math.max(new Date(buyDate).getTime(), startDateObj.getTime()));
  const end = new Date();
  const fromCurrency = (asset.currency || 'USD') as CurrencyCode;
  const toCurrency = targetCurrency as CurrencyCode;

  // 无历史价格资产（现金、不动产、汽车、自定义资产，以及自定义符号的基金、股票等）
if (['car', 'real_estate', 'custom', 'custom_asset', 'receivable'].includes(asset.type) 
    || asset.symbol.startsWith('CUSTOM-') 
    || asset.symbol.startsWith('CASH-') 
    || asset.symbol.startsWith('REAL_ESTATE-') 
    || asset.symbol.startsWith('CAR-')) {
  // 静态资产处理
  const priceMap = new Map<string, number>();
  let current = new Date(start);
  let price = asset.price;
  try {
    price = await convertAmount(price, fromCurrency, toCurrency);
  } catch (err) {
    console.error(`静态资产汇率转换失败 ${asset.symbol}:`, err);
  }
  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    priceMap.set(dateStr, price);
    current.setDate(current.getDate() + 1);
  }
  return { holdings: asset.holdings, type: asset.type, priceMap, symbol: asset.symbol };
}

  // 负债资产
  if (asset.type === 'liability') {
    const priceMap = new Map<string, number>();
    let current = new Date(start);
    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      priceMap.set(dateStr, 1);
      current.setDate(current.getDate() + 1);
    }
    const holdings = Math.abs(asset.marketValue);
    return { holdings, type: asset.type, priceMap, symbol: asset.symbol };
  }

  // 有历史数据的资产（股票、基金、加密货币）
  console.log(`[历史资产] ${asset.symbol}, 类型=${asset.type}, 买入日期=${buyDate}`);
  const historyMap = await getAssetHistoryWithCurrency(asset.symbol, asset.type, buyDate, fromCurrency, toCurrency, baseUrl);
  const filledMap = new Map<string, number>();
  let lastPrice: number | null = null;
  let current = new Date(start);
  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    const price = historyMap.get(dateStr);
    if (price !== undefined) {
      lastPrice = price;
      filledMap.set(dateStr, price);
    } else if (lastPrice !== null) {
      filledMap.set(dateStr, lastPrice);
    }
    current.setDate(current.getDate() + 1);
  }
  return { holdings: asset.holdings, type: asset.type, priceMap: filledMap, symbol: asset.symbol };
}));

    const results: { timestamp: number; value: number }[] = [];
    const currentDate = new Date(startDateObj);
    const today = new Date();

    while (currentDate <= today) {
      const dateStr = currentDate.toISOString().split('T')[0];
      let netWorth = 0;
      for (const asset of assetHistories) {
        const price = asset.priceMap.get(dateStr);
        if (price !== undefined) {
          if (asset.type === 'liability') {
            netWorth -= asset.holdings * price;
          } else {
            netWorth += asset.holdings * price;
          }
        }
      }
      results.push({
        timestamp: currentDate.getTime(),
        value: netWorth,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return NextResponse.json({ data: results });
  } catch (error) {
    console.error('Snapshot history error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}