// app/api/snapshot/history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { convertAmount } from '@/src/services/forex';
import { CurrencyCode } from '@/src/services/currency';
import { fetchStockMinuteData } from '@/app/api/data-sources/yahoo-finance';

const sql = neon(process.env.POSTGRES_URL!);

// 新增：从雅虎财经获取股票日线数据
async function fetchYahooDailyHistory(
  symbol: string,
  startDate: string,
  endDate: string
): Promise<{ date: string; open: number; high: number; low: number; close: number; volume: number }[] | null> {
  try {
    const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
    const endTimestamp = Math.floor(new Date(endDate).getTime() / 1000);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&period1=${startTimestamp}&period2=${endTimestamp}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.chart?.result?.[0]) return null;
    const result = data.chart.result[0];
    const timestamps = result.timestamp;
    const quote = result.indicators?.quote?.[0];
    if (!timestamps || !quote) return null;
    const ohlcv = [];
    for (let i = 0; i < timestamps.length; i++) {
      const open = quote.open?.[i];
      const high = quote.high?.[i];
      const low = quote.low?.[i];
      const close = quote.close?.[i];
      const volume = quote.volume?.[i];
      if (open == null || high == null || low == null || close == null || volume == null) continue;
      const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
      ohlcv.push({ date, open, high, low, close, volume });
    }
    return ohlcv;
  } catch (error) {
    console.error(`雅虎财经日线拉取失败 ${symbol}:`, error);
    return null;
  }
}

// 新增：从数据库获取股票日线历史价格，不足则从雅虎财经拉取并存储
async function getStockDailyHistoryFromDB(
  symbol: string,
  startDate: string,
  endDate: string,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode
): Promise<Map<string, number>> {
  try {
    // 从数据库查询已有数据
    let rows = await sql`
      SELECT date, close
      FROM stock_price_history
      WHERE symbol = ${symbol}
        AND date >= ${startDate}
        AND date <= ${endDate}
      ORDER BY date ASC
    `;

    // 如果数据量不足（少于期望值的80%），则从雅虎财经拉取
    const startTime = new Date(startDate).getTime();
    const endTime = new Date(endDate).getTime();
    const expectedDays = Math.ceil((endTime - startTime) / (1000 * 3600 * 24)) + 1;
    if (rows.length < expectedDays * 0.8) {
      console.log(`[StockDaily] 数据不足，从雅虎财经拉取 ${symbol}`);
      const ohlcv = await fetchYahooDailyHistory(symbol, startDate, endDate);
      if (ohlcv && ohlcv.length > 0) {
        // 存入数据库
        for (const bar of ohlcv) {
          await sql`
            INSERT INTO stock_price_history (symbol, date, open, high, low, close, volume)
            VALUES (${symbol}, ${bar.date}, ${bar.open}, ${bar.high}, ${bar.low}, ${bar.close}, ${bar.volume})
            ON CONFLICT (symbol, date) DO UPDATE SET
              open = EXCLUDED.open,
              high = EXCLUDED.high,
              low = EXCLUDED.low,
              close = EXCLUDED.close,
              volume = EXCLUDED.volume
          `;
        }
        // 重新查询
        rows = await sql`
          SELECT date, close
          FROM stock_price_history
          WHERE symbol = ${symbol}
            AND date >= ${startDate}
            AND date <= ${endDate}
          ORDER BY date ASC
        `;
      }
    }

    const map = new Map<string, number>();
    for (const row of rows) {
      let price = parseFloat(row.close);
      try {
        price = await convertAmount(price, fromCurrency, toCurrency);
      } catch (err) {}
      let dateKey: string;
      if (typeof row.date === 'string') {
        dateKey = row.date.split('T')[0];
      } else if (row.date instanceof Date) {
        dateKey = row.date.toISOString().split('T')[0];
      } else {
        dateKey = String(row.date);
      }
      map.set(dateKey, price);
    }
    console.log(`[${symbol}] 数据库返回 ${rows.length} 条，日期范围: ${map.keys().next().value} 至 ${Array.from(map.keys()).pop()}`);
    return map;
  } catch (error) {
    console.error(`获取股票日线数据失败 ${symbol}:`, error);
    return new Map();
  }
}

// 从数据库获取加密货币的日线历史价格（返回 Map<日期字符串, 价格>）
async function getCryptoDailyHistoryFromDB(
  symbol: string,
  startDate: string,
  endDate: string,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode
): Promise<Map<string, number>> {
  try {
    const rows = await sql`
      SELECT date, close
      FROM crypto_price_history
      WHERE symbol = ${symbol}
        AND date >= ${startDate}
        AND date <= ${endDate}
      ORDER BY date ASC
    `;
    const map = new Map<string, number>();
    for (const row of rows) {
      let price = parseFloat(row.close);
      try {
        price = await convertAmount(price, fromCurrency, toCurrency);
      } catch (err) {}
      // 关键修复：确保日期格式为 YYYY-MM-DD
      let dateKey: string;
      if (typeof row.date === 'string') {
        dateKey = row.date.split('T')[0]; // 处理可能的时间部分
      } else if (row.date instanceof Date) {
        dateKey = row.date.toISOString().split('T')[0];
      } else {
        dateKey = String(row.date);
      }
      map.set(dateKey, price);
    }
    // 添加调试日志
    console.log(`[${symbol}] 数据库返回 ${rows.length} 条，日期范围: ${map.keys().next().value} 至 ${Array.from(map.keys()).pop()}`);
    return map;
  } catch (error) {
    console.error(`从数据库获取加密货币日线数据失败 ${symbol}:`, error);
    return new Map();
  }
}

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
  } else if (type === 'liability') {
    // 负债资产：价格应为正数，净值中减去其价值
    currentPrice = Math.abs(currentPrice);
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    let current = new Date(startDate);
    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      dailyMap.set(dateStr, currentPrice);
      current.setDate(current.getDate() + 1);
    }
  } else if (['car', 'real_estate', 'custom', 'custom_asset', 'receivable'].includes(type)
              || asset.symbol.startsWith('CUSTOM-')
              || asset.symbol.startsWith('CASH-')
              || asset.symbol.startsWith('REAL_ESTATE-')
              || asset.symbol.startsWith('CAR-')) {
    // 其他自定义资产：没有历史价格，使用当前价格填充每天
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

  // 返回时增加 symbol 和 name，便于调试
  return {
    holdings,
    type,
    isCrypto,
    isStockOrEtf,
    dailyMap,
    hourlyMap,
    buyTimestamp,
    currentPrice,
    symbol: asset.symbol,
    name: asset.name,
  };
}));

      // 生成 168 个小时的时间戳（整点）
      const timestamps: number[] = [];
      for (let i = 0; i < hoursAgo; i++) {
        const ts = startTime.getTime() + i * 60 * 60 * 1000;
        timestamps.push(ts);
      }

      const results: { timestamp: number; value: number }[] = [];
      for (let idx = 0; idx < timestamps.length; idx++) {
        const ts = timestamps[idx];
        const date = new Date(ts);
        const dateStr = date.toISOString().split('T')[0];
        let netWorth = 0;

        const isLast = (idx === timestamps.length - 1); // 判断是否是最后一个时间戳
        if (isLast) {
          console.log('\n=== 走势图最后一个小时净值明细 ===');
          console.log(`时间戳: ${ts} (${new Date(ts).toLocaleString()})`);
        }

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
            const contribution = asset.type === 'liability' ? -(asset.holdings * price) : (asset.holdings * price);
            netWorth += contribution;

            if (isLast) {
              console.log(
                `[${asset.symbol || asset.name || asset.type}] ` +
                `holdings=${asset.holdings.toFixed(2)} price=${price.toFixed(2)} ` +
                `contribution=${contribution.toFixed(2)}`
              );
            }
          }
        }

        if (isLast) {
          console.log(`总和: ${netWorth.toFixed(2)}`);
          console.log('===================================\n');
        }

        results.push({ timestamp: ts, value: netWorth });
      }

      return NextResponse.json({ data: results });
    }

// 其他周期（1M, 6M）统一使用日线逻辑，复用 1W 的资产预处理方式
 let daysAgo: number;
    switch (period) {
      case '1M': daysAgo = 30; break;
      case '6M': daysAgo = 180; break;
      default: daysAgo = 30;
    }
    const startDateObj = new Date();
    startDateObj.setDate(startDateObj.getDate() - daysAgo);
    startDateObj.setHours(0, 0, 0, 0);
    const endDateObj = new Date();
    endDateObj.setHours(0, 0, 0, 0);

    if (!assets || assets.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // 预处理每个资产（复用 1W 的逻辑，但只使用 dailyMap）
    const assetData = await Promise.all(assets.map(async (asset: any) => {
      const fromCurrency = (asset.currency || 'USD') as CurrencyCode;
      const toCurrency = targetCurrency as CurrencyCode;
      const holdings = asset.holdings;
      const type = asset.type;

      // 购买日期时间戳（毫秒），用于过滤
      let buyTimestamp = -Infinity;
      if (asset.purchaseDate) {
        buyTimestamp = new Date(asset.purchaseDate).getTime();
      }

      // 当前价格（转换后）
      let currentPrice = asset.price;
      try {
        currentPrice = await convertAmount(currentPrice, fromCurrency, toCurrency);
      } catch (err) {}

      let dailyMap = new Map<string, number>();

      // 根据资产类型构建 dailyMap
      if (type === 'crypto') {
        // 加密货币：从数据库获取日线数据
        const startStr = startDateObj.toISOString().split('T')[0];
        const endStr = endDateObj.toISOString().split('T')[0];
        console.log(`[${period}] 请求 ${asset.symbol} 日线: ${startStr} -> ${endStr}`);
        const historyMap = await getCryptoDailyHistoryFromDB(
          asset.symbol,
          startStr,
          endStr,
          fromCurrency,
          toCurrency
        );
        console.log(`[${period}] ${asset.symbol} 数据库返回 ${historyMap.size} 条数据`);
        
        // 填充 dailyMap
        let lastPrice: number | null = null;
        let curDate = new Date(startDateObj);
        let filledCount = 0;
        while (curDate <= endDateObj) {
          const dateStr = curDate.toISOString().split('T')[0];
          const price = historyMap.get(dateStr);
          if (price !== undefined) {
            lastPrice = price;
            dailyMap.set(dateStr, price);
            filledCount++;
          } else if (lastPrice !== null) {
            dailyMap.set(dateStr, lastPrice);
          }
          curDate.setDate(curDate.getDate() + 1);
        }
        console.log(`[${period}] ${asset.symbol} 最终 dailyMap 大小: ${dailyMap.size}, 直接匹配数: ${filledCount}`);
        if (dailyMap.size === 0) {
          console.warn(`[${period}] 加密货币 ${asset.symbol} 无历史数据，使用当前价格填充`);
          let curDate = new Date(startDateObj);
          while (curDate <= endDateObj) {
            const dateStr = curDate.toISOString().split('T')[0];
            dailyMap.set(dateStr, currentPrice);
            curDate.setDate(curDate.getDate() + 1);
          }
        }
      } else if (type === 'liability') {
        // 负债：价格取绝对值，用当前价格填充所有日期
        const absPrice = Math.abs(currentPrice);
        let curDate = new Date(startDateObj);
        while (curDate <= endDateObj) {
          const dateStr = curDate.toISOString().split('T')[0];
          dailyMap.set(dateStr, absPrice);
          curDate.setDate(curDate.getDate() + 1);
        }
      } else if (['car', 'real_estate', 'custom', 'custom_asset', 'receivable'].includes(type)
                 || asset.symbol.startsWith('CUSTOM-')
                 || asset.symbol.startsWith('CASH-')
                 || asset.symbol.startsWith('REAL_ESTATE-')
                 || asset.symbol.startsWith('CAR-')) {
        // 自定义资产：使用当前价格填充每天
        let curDate = new Date(startDateObj);
        while (curDate <= endDateObj) {
          const dateStr = curDate.toISOString().split('T')[0];
          dailyMap.set(dateStr, currentPrice);
          curDate.setDate(curDate.getDate() + 1);
        }
      } else {
        // 股票、基金、贵金属等：从数据库获取日线数据（优先数据库，不足则拉取）
        const startStr = startDateObj.toISOString().split('T')[0];
        const endStr = endDateObj.toISOString().split('T')[0];
        const historyMap = await getStockDailyHistoryFromDB(
          asset.symbol,
          startStr,
          endStr,
          fromCurrency,
          toCurrency
        );
        // 填充 dailyMap，缺失时用最近价格
        let lastPrice: number | null = null;
        let curDate = new Date(startDateObj);
        let filledCount = 0;
        while (curDate <= endDateObj) {
          const dateStr = curDate.toISOString().split('T')[0];
          const price = historyMap.get(dateStr);
          if (price !== undefined) {
            lastPrice = price;
            dailyMap.set(dateStr, price);
            filledCount++;
          } else if (lastPrice !== null) {
            dailyMap.set(dateStr, lastPrice);
          }
          curDate.setDate(curDate.getDate() + 1);
        }
        console.log(`[${period}] 股票 ${asset.symbol} 最终 dailyMap 大小: ${dailyMap.size}, 直接匹配数: ${filledCount}`);
        if (dailyMap.size === 0) {
          console.warn(`[${period}] 资产 ${asset.symbol} 无历史数据，使用当前价格填充`);
          let curDate = new Date(startDateObj);
          while (curDate <= endDateObj) {
            const dateStr = curDate.toISOString().split('T')[0];
            dailyMap.set(dateStr, currentPrice);
            curDate.setDate(curDate.getDate() + 1);
          }
        }
      }

      return {
        holdings,
        type,
        dailyMap,
        buyTimestamp,
        symbol: asset.symbol,
        name: asset.name,
      };
    }));


// 生成日期序列
const timestamps: number[] = [];
let curDate = new Date(startDateObj);
while (curDate <= endDateObj) {
  timestamps.push(curDate.getTime());
  curDate.setDate(curDate.getDate() + 1);
}

const results: { timestamp: number; value: number }[] = [];
for (let idx = 0; idx < timestamps.length; idx++) {
  const ts = timestamps[idx];
  const date = new Date(ts);
  const dateStr = date.toISOString().split('T')[0];
  let netWorth = 0;

  const isLast = (idx === timestamps.length - 1);
  if (isLast) {
    console.log(`\n=== 走势图最后一天净值明细 (${period}) ===`);
    console.log(`日期: ${dateStr}`);
  }

  for (const asset of assetData) {
    // 跳过购买日之后的资产（如果购买日晚于当前日期）
    if (ts < asset.buyTimestamp) continue;
    const price = asset.dailyMap.get(dateStr);
    if (price !== undefined) {
      const contribution = asset.type === 'liability' ? -(asset.holdings * price) : (asset.holdings * price);
      netWorth += contribution;
      if (isLast) {
        console.log(
          `[${asset.symbol || asset.name || asset.type}] ` +
          `holdings=${asset.holdings.toFixed(2)} price=${price.toFixed(2)} ` +
          `contribution=${contribution.toFixed(2)}`
        );
      }
    }
  }

  if (isLast) {
    console.log(`总和: ${netWorth.toFixed(2)}`);
    console.log('===================================\n');
  }

  results.push({ timestamp: ts, value: netWorth });
}

return NextResponse.json({ data: results });
  } catch (error) {
    console.error('Snapshot history error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}