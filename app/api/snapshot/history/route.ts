// app/api/snapshot/history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { convertAmount } from '@/src/services/forex';
import { CurrencyCode } from '@/src/services/currency';

const sql = neon(process.env.POSTGRES_URL!);

// 获取单个资产的历史价格（日线），并转换为目标货币
async function getAssetHistoryWithCurrency(
  symbol: string,
  type: string,
  startDate: string,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode
): Promise<Map<string, number>> {
  const url = new URL('/api/history', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000');
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('type', type);
  url.searchParams.set('range', 'since_holding');
  url.searchParams.set('startDate', startDate);
  const res = await fetch(url.toString());
  const json = await res.json();
  if (!json.success) return new Map();
  const history = json.data as { date: string; value: number }[];
  const map = new Map<string, number>();
  for (const point of history) {
    const dateStr = point.date.split('T')[0];
    const convertedPrice = await convertAmount(point.value, fromCurrency, toCurrency);
    map.set(dateStr, convertedPrice);
  }
  return map;
}

export async function POST(request: NextRequest) {
  try {
    const { userId, period, targetCurrency, assets } = await request.json();
    if (!userId || !period) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // 1日：使用快照，并转换为 targetCurrency
    if (period === '1D') {
      const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const snapshots = await sql`
        SELECT snapshot_time, net_worth FROM snapshots
        WHERE user_id = ${userId} AND snapshot_time >= ${startTime.toISOString()}
        ORDER BY snapshot_time ASC
      `;
      const results = await Promise.all(snapshots.map(async (s) => ({
        timestamp: new Date(s.snapshot_time).getTime(),
        value: await convertAmount(s.net_worth, 'CNY', targetCurrency as CurrencyCode),
      })));
      return NextResponse.json({ data: results });
    }

    // 其他周期：实时计算，并转换为 targetCurrency
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

    // 构建每个资产的历史价格 map（已转换为 targetCurrency）
    const assetHistories = await Promise.all(assets.map(async (asset: any) => {
      const buyDate = asset.purchaseDate || startStr;
      const start = new Date(Math.max(new Date(buyDate).getTime(), startDateObj.getTime()));
      const end = new Date();
      const fromCurrency = (asset.currency || 'USD') as CurrencyCode;
      const toCurrency = targetCurrency as CurrencyCode;

      // 无历史价格资产（现金、不动产、汽车等）
      if (['car', 'real_estate', 'custom', 'custom_asset', 'receivable'].includes(asset.type)) {
        const priceMap = new Map<string, number>();
        let current = new Date(start);
        while (current <= end) {
          const dateStr = current.toISOString().split('T')[0];
          const convertedPrice = await convertAmount(asset.price, fromCurrency, toCurrency);
          priceMap.set(dateStr, convertedPrice);
          current.setDate(current.getDate() + 1);
        }
        return { holdings: asset.holdings, type: asset.type, priceMap };
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
        return { holdings, type: asset.type, priceMap };
      }

      // 有历史数据的资产
      const historyMap = await getAssetHistoryWithCurrency(asset.symbol, asset.type, buyDate, fromCurrency, toCurrency);
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
      return { holdings: asset.holdings, type: asset.type, priceMap: filledMap };
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