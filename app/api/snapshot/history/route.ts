// app/api/snapshot/history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { convertAmount } from '@/src/services/forex';
import { CurrencyCode } from '@/src/services/currency';

const sql = neon(process.env.POSTGRES_URL!);

// 获取资产的日线历史价格（返回 Map<日期字符串, 价格>）
async function getAssetDailyHistory(
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
    if (!res.ok) return new Map();
    const json = await res.json();
    if (!json.success) return new Map();
    const history = json.data as { date: string; value: number }[];
    const map = new Map<string, number>();
    for (const point of history) {
      const dateStr = point.date.split('T')[0];
      let price = point.value;
      try {
        price = await convertAmount(price, fromCurrency, toCurrency);
      } catch (err) {}
      map.set(dateStr, price);
    }
    return map;
  } catch (error) {
    return new Map();
  }
}

// 从数据库获取加密货币的小时级历史价格（返回 Map<时间戳毫秒, 价格>）
async function getCryptoHourlyHistoryFromDB(
  symbol: string,
  startTime: number,
  endTime: number,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode
): Promise<Map<number, number>> {
  const startSec = Math.floor(startTime / 1000);
  const endSec = Math.floor(endTime / 1000);
  try {
    const rows = await sql`
      SELECT timestamp, close
      FROM crypto_minute_history
      WHERE symbol = ${symbol}
        AND resolution = '1h'
        AND timestamp >= ${startSec}
        AND timestamp <= ${endSec}
      ORDER BY timestamp ASC
    `;
    const map = new Map<number, number>();
    for (const row of rows) {
      let price = parseFloat(row.close);
      try {
        price = await convertAmount(price, fromCurrency, toCurrency);
      } catch (err) {}
      map.set(row.timestamp * 1000, price);
    }
    return map;
  } catch (error) {
    console.error(`从数据库获取加密货币小时数据失败 ${symbol}:`, error);
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

    // 处理 1D（过去24小时）直接使用快照
    if (period === '1D') {
      const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const startStr = startTime.toISOString();
      const snapshots = await sql`
        SELECT EXTRACT(EPOCH FROM snapshot_time) * 1000 as timestamp, net_worth
        FROM snapshots
        WHERE user_id = ${userId} AND snapshot_time >= ${startStr}
        ORDER BY snapshot_time ASC
      `;
      const results = await Promise.all(snapshots.map(async (s) => {
        let value = s.net_worth;
        try {
          value = await convertAmount(value, 'CNY', targetCurrency as CurrencyCode);
        } catch (err) {}
        return { timestamp: s.timestamp, value };
      }));
      return NextResponse.json({ data: results });
    }

    // 1W：小时级净值（基于资产真实历史价格，加密货币从数据库取小时数据，其他用日线填充当天所有小时）
    if (period === '1W') {
      const hoursAgo = 168;
      const now = new Date();
      const startTime = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
      startTime.setMinutes(0, 0, 0);
      const endTime = new Date(now.getTime());
      endTime.setMinutes(0, 0, 0);

      if (!assets || assets.length === 0) {
        return NextResponse.json({ data: [] });
      }

      // 预处理每个资产，获取其价格数据
      const assetData = await Promise.all(assets.map(async (asset: any) => {
        const fromCurrency = (asset.currency || 'USD') as CurrencyCode;
        const toCurrency = targetCurrency as CurrencyCode;
        const holdings = asset.holdings;

        // 获取日线数据（所有资产都需要，用于非加密货币或加密货币缺失小时数据时填充）
        const dailyMap = await getAssetDailyHistory(
          asset.symbol, asset.type,
          startTime.toISOString().split('T')[0],
          fromCurrency, toCurrency, baseUrl
        );

        // 加密货币额外从数据库获取小时数据
        let hourlyMap: Map<number, number> = new Map();
        if (asset.type === 'crypto') {
          hourlyMap = await getCryptoHourlyHistoryFromDB(
            asset.symbol, startTime.getTime(), endTime.getTime(),
            fromCurrency, toCurrency
          );
        }

        return {
          holdings,
          type: asset.type,
          dailyMap,
          hourlyMap,
          isCrypto: asset.type === 'crypto',
        };
      }));

      // 生成 168 个小时的时间戳（整点）
      const timestamps: number[] = [];
      for (let i = 0; i < hoursAgo; i++) {
        const ts = startTime.getTime() + i * 60 * 60 * 1000;
        timestamps.push(ts);
      }

      const results: { timestamp: number; value: number }[] = [];
      for (const ts of timestamps) {
        const date = new Date(ts);
        const dateStr = date.toISOString().split('T')[0];
        let netWorth = 0;

        for (const asset of assetData) {
          let price: number | null = null;

          // 优先使用小时数据（仅加密货币可能有）
          if (asset.isCrypto && asset.hourlyMap.has(ts)) {
            price = asset.hourlyMap.get(ts)!;
          } else {
            // 否则使用当天日线价格
            if (asset.dailyMap.has(dateStr)) {
              price = asset.dailyMap.get(dateStr)!;
            } else {
              // 日线也没有，可能是自定义资产或新资产，使用当前价格
              const originalAsset = assets.find((a: any) => a.symbol === asset.symbol);
              if (originalAsset) {
                let fallbackPrice = originalAsset.price;
                try {
                  fallbackPrice = await convertAmount(fallbackPrice, (originalAsset.currency || 'USD') as CurrencyCode, targetCurrency as CurrencyCode);
                } catch (err) {}
                price = fallbackPrice;
              }
            }
          }

          if (price !== null) {
            if (asset.type === 'liability') {
              netWorth -= asset.holdings * price;
            } else {
              netWorth += asset.holdings * price;
            }
          }
        }
        results.push({ timestamp: ts, value: netWorth });
      }

      return NextResponse.json({ data: results });
    }

    // 其他周期（1M, 6M）保持原有日线逻辑
    let daysAgo: number;
    switch (period) {
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

      if (['car', 'real_estate', 'custom', 'custom_asset', 'receivable'].includes(asset.type)
          || asset.symbol.startsWith('CUSTOM-')
          || asset.symbol.startsWith('CASH-')
          || asset.symbol.startsWith('REAL_ESTATE-')
          || asset.symbol.startsWith('CAR-')) {
        const priceMap = new Map<string, number>();
        let current = new Date(start);
        let price = asset.price;
        try {
          price = await convertAmount(price, fromCurrency, toCurrency);
        } catch (err) {}
        while (current <= end) {
          const dateStr = current.toISOString().split('T')[0];
          priceMap.set(dateStr, price);
          current.setDate(current.getDate() + 1);
        }
        return { holdings: asset.holdings, type: asset.type, priceMap, symbol: asset.symbol };
      }

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

      const historyMap = await getAssetDailyHistory(asset.symbol, asset.type, buyDate, fromCurrency, toCurrency, baseUrl);
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