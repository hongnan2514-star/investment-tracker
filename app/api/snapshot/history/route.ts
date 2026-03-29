// app/api/snapshot/history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { convertAmount } from '@/src/services/forex';
import { CurrencyCode } from '@/src/services/currency';
import { fetchStockMinuteData } from '@/app/api/data-sources/yahoo-finance';

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

// 获取股票/ETF 的小时级历史价格（从数据库读取，不足时从雅虎财经拉取并存储）
async function getStockHourlyHistoryFromDB(
  symbol: string,
  startTime: number,
  endTime: number,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode
): Promise<Map<number, number>> {
  const startSec = Math.floor(startTime / 1000);
  const endSec = Math.floor(endTime / 1000);
  try {
    // 从数据库查询已有数据
    let rows = await sql`
      SELECT timestamp, close
      FROM stock_minute_history
      WHERE symbol = ${symbol}
        AND resolution = '1h'
        AND timestamp >= ${startSec}
        AND timestamp <= ${endSec}
      ORDER BY timestamp ASC
    `;

    // 如果数据量不足（少于期望值的80%），则从雅虎财经拉取
    const expectedHours = (endSec - startSec) / 3600;
    if (rows.length < expectedHours * 0.8) {
      console.log(`[StockHourly] 数据不足，从雅虎财经拉取 ${symbol}`);
      const ohlcv = await fetchStockMinuteData(symbol, '1h', 168, startTime);
      if (ohlcv && ohlcv.length > 0) {
        // 存入数据库
        for (const bar of ohlcv) {
          await sql`
            INSERT INTO stock_minute_history (symbol, resolution, timestamp, open, high, low, close, volume)
            VALUES (${symbol}, '1h', ${bar.timestamp}, ${bar.open}, ${bar.high}, ${bar.low}, ${bar.close}, ${bar.volume})
            ON CONFLICT (symbol, resolution, timestamp) DO UPDATE SET
              open = EXCLUDED.open,
              high = EXCLUDED.high,
              low = EXCLUDED.low,
              close = EXCLUDED.close,
              volume = EXCLUDED.volume
          `;
        }
        // 重新查询
        rows = await sql`
          SELECT timestamp, close
          FROM stock_minute_history
          WHERE symbol = ${symbol}
            AND resolution = '1h'
            AND timestamp >= ${startSec}
            AND timestamp <= ${endSec}
          ORDER BY timestamp ASC
        `;
      }
    }

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
    console.error(`获取股票小时数据失败 ${symbol}:`, error);
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

    // 1W：小时级净值（基于资产真实历史价格）
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

      // 预处理每个资产
      const assetData = await Promise.all(assets.map(async (asset: any) => {
        const fromCurrency = (asset.currency || 'USD') as CurrencyCode;
        const toCurrency = targetCurrency as CurrencyCode;
        const holdings = asset.holdings;
        const type = asset.type;

        // 购买日期时间戳（毫秒），若无则设为 -Infinity（始终有效）
        let buyTimestamp = -Infinity;
        if (asset.purchaseDate) {
          buyTimestamp = new Date(asset.purchaseDate).getTime();
        }

        // 获取当前价格（转换后），作为回退值
        let currentPrice = asset.price;
        try {
          currentPrice = await convertAmount(currentPrice, fromCurrency, toCurrency);
        } catch (err) {}

        let dailyMap = new Map<string, number>();
        let hourlyMap = new Map<number, number>();
        const isCrypto = type === 'crypto';
        const isStockOrEtf = type === 'stock' || type === 'etf';

        if (isCrypto) {
          // 加密货币：从数据库获取小时数据
          hourlyMap = await getCryptoHourlyHistoryFromDB(
            asset.symbol, startTime.getTime(), endTime.getTime(),
            fromCurrency, toCurrency
          );
          // 同时获取日线数据，用于小时数据缺失时的回退
          const daily = await getAssetDailyHistory(
            asset.symbol, type,
            startTime.toISOString().split('T')[0],
            fromCurrency, toCurrency, baseUrl
          );
          dailyMap = daily;
        } else if (isStockOrEtf) {
          // 股票/ETF：从数据库获取小时数据（不足则从雅虎财经拉取）
          hourlyMap = await getStockHourlyHistoryFromDB(
            asset.symbol, startTime.getTime(), endTime.getTime(),
            fromCurrency, toCurrency
          );
          // 同时获取日线数据，作为回退（以防小时数据缺失）
          const daily = await getAssetDailyHistory(
            asset.symbol, type,
            startTime.toISOString().split('T')[0],
            fromCurrency, toCurrency, baseUrl
          );
          dailyMap = daily;
        } else if (['car', 'real_estate', 'custom', 'custom_asset', 'receivable', 'liability'].includes(type)
            || asset.symbol.startsWith('CUSTOM-')
            || asset.symbol.startsWith('CASH-')
            || asset.symbol.startsWith('REAL_ESTATE-')
            || asset.symbol.startsWith('CAR-')) {
          // 自定义资产：没有历史价格，使用当前价格填充每天
          const startDate = new Date(startTime);
          const endDate = new Date(endTime);
          let current = new Date(startDate);
          while (current <= endDate) {
            const dateStr = current.toISOString().split('T')[0];
            dailyMap.set(dateStr, currentPrice);
            current.setDate(current.getDate() + 1);
          }
        } else {
          // 其他资产（基金、贵金属等）：获取日线历史价格
          dailyMap = await getAssetDailyHistory(
            asset.symbol, type,
            startTime.toISOString().split('T')[0],
            fromCurrency, toCurrency, baseUrl
          );
        }

        return {
          holdings,
          type,
          isCrypto,
          isStockOrEtf,
          dailyMap,
          hourlyMap,
          buyTimestamp,
          currentPrice,
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
          // 跳过购买日之前的时刻
          if (ts < asset.buyTimestamp) continue;

          let price: number | null = null;

          // 优先使用小时数据（仅对加密货币和股票/ETF）
          if ((asset.isCrypto || asset.isStockOrEtf) && asset.hourlyMap.has(ts)) {
            price = asset.hourlyMap.get(ts)!;
          } else if (asset.dailyMap.has(dateStr)) {
            price = asset.dailyMap.get(dateStr)!;
          } else {
            price = asset.currentPrice;
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