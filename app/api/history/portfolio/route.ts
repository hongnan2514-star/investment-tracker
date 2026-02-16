import { NextRequest, NextResponse } from 'next/server';
import { Asset } from '@/src/constants/types';

const priceCache: Record<string, { timestamp: number; price: number }[]> = {};

function normalizeAStockSymbol(symbol: string): string {
  const trimmed = symbol.trim();
  if (/^[0-9]{6}$/.test(trimmed)) {
    if (trimmed.startsWith('6') || trimmed.startsWith('5')) return `${trimmed}.SS`;
    else if (trimmed.startsWith('0') || trimmed.startsWith('3') || trimmed.startsWith('1')) return `${trimmed}.SZ`;
  }
  return trimmed;
}

// 扩展 interval 类型，支持更多粒度
async function fetchYahooHistory(symbol: string, startDate: Date, endDate: Date, interval: '1d' | '1h' | '15m' | '2m' | '5m') {
  console.log(`[DEBUG] 请求 ${symbol} 从 ${startDate.toISOString()} 到 ${endDate.toISOString()} 间隔 ${interval}`);
  
  const cacheKey = `yahoo_${symbol}_${interval}`;
  if (priceCache[cacheKey]) {
    console.log(`[DEBUG] 使用缓存 ${symbol} ${interval}`);
    return priceCache[cacheKey];
  }

  const startStr = Math.floor(startDate.getTime() / 1000);
  const endStr = Math.floor(endDate.getTime() / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${startStr}&period2=${endStr}&interval=${interval}`;
  
  console.log(`[DEBUG] API URL: ${url}`);

  try {
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.chart?.result?.[0]?.meta) {
      console.log(`[DEBUG] ${symbol} 元数据:`, {
        range: data.chart.result[0].meta.range,
        regularMarketPrice: data.chart.result[0].meta.regularMarketPrice,
        previousClose: data.chart.result[0].meta.previousClose,
        dataGranularity: data.chart.result[0].meta.dataGranularity
      });
    }
    
    const result = data.chart?.result?.[0];
    if (!result) {
      console.log(`[DEBUG] ${symbol} 无结果, 错误信息:`, data.chart?.error);
      return [];
    }

    const timestamps: number[] = result.timestamp;
    const closes: (number | null)[] = result.indicators?.quote?.[0]?.close;
    
    console.log(`[DEBUG] ${symbol} 获取到 ${timestamps?.length || 0} 个时间戳`);
    if (timestamps && timestamps.length > 0) {
      console.log(`[DEBUG] 第一个时间戳: ${new Date(timestamps[0] * 1000).toISOString()}`);
      console.log(`[DEBUG] 最后一个时间戳: ${new Date(timestamps[timestamps.length-1] * 1000).toISOString()}`);
      if (timestamps.length > 1) {
        console.log(`[DEBUG] 数据点间隔(分钟):`, (timestamps[1] - timestamps[0]) / 60);
      }
    }

    if (!timestamps || !closes) return [];

    const history = timestamps
      .map((ts, i) => ({ timestamp: ts * 1000, price: closes[i] }))
      .filter((item): item is { timestamp: number; price: number } => item.price !== null);

    priceCache[cacheKey] = history;
    return history;
  } catch (error) {
    console.error(`获取 ${symbol} 历史数据失败`, error);
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const { assets, period } = await req.json() as { assets: Asset[]; period: '1D' | '1W' | '1M' | '6M' };
    console.log(`接收到资产数量: ${assets.length}, 周期: ${period}`);

    if (assets.length === 0) return NextResponse.json({ data: [] });

    const today = new Date();
    const endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000); // 增加一天确保数据完整

    let startDate: Date;
    switch (period) {
      case '1D':
        startDate = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '1W':
        startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '1M':
        startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '6M':
        startDate = new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    }
    console.log(`起始日期: ${startDate.toISOString()}, 结束日期: ${endDate.toISOString()}`);

    // 获取每个资产的历史价格
    const assetHistories = await Promise.all(
      assets.map(async (asset) => {
        const apiSymbol = (asset.type === 'stock' || asset.type === 'etf') 
          ? normalizeAStockSymbol(asset.symbol) 
          : asset.symbol;

        let history: { timestamp: number; price: number }[] = [];

        if (asset.type === 'stock' || asset.type === 'etf') {
          // 根据周期选择间隔策略
          if (period === '1D') {
            // 1D周期：尝试多个细粒度间隔，直到成功
            const intervals: ('2m' | '5m' | '15m' | '1h')[] = ['2m', '5m', '15m', '1h'];
            for (const intv of intervals) {
              history = await fetchYahooHistory(apiSymbol, startDate, endDate, intv);
              console.log(`资产 ${asset.symbol} (${apiSymbol}) 获取到 ${history.length} 条数据 (间隔: ${intv})`);
              if (history.length > 0) {
                break;
              }
            }
            // 如果所有间隔都失败，则使用日线（不填充）
            if (history.length === 0) {
              const daily = await fetchYahooHistory(apiSymbol, startDate, endDate, '1d');
              console.log(`所有间隔失败，尝试日线，获取到 ${daily.length} 条`);
              if (daily.length > 0) {
                history = daily;
              }
            }
          } else {
            // 其他周期：使用固定间隔（保持不变）
            let interval: '1d' | '1h' | '15m';
            if (period === '1W') {
              interval = '15m';
            } else if (period === '1M') {
              interval = '1h';
            } else { // 6M
              interval = '1d';
            }
            history = await fetchYahooHistory(apiSymbol, startDate, endDate, interval);
            console.log(`资产 ${asset.symbol} (${apiSymbol}) 获取到 ${history.length} 条数据 (间隔: ${interval})`);

            // 降级方案：如果所需间隔无数据，尝试日线（不填充）
            if (history.length === 0) {
              const daily = await fetchYahooHistory(apiSymbol, startDate, endDate, '1d');
              console.log(`  ${interval} 失败，尝试日线，获取到 ${daily.length} 条`);
              if (daily.length > 0) {
                history = daily;
              }
            }
          }
        }
        return { holdings: asset.holdings, history };
      })
    );

    const timeTotals: Record<number, number> = {};
    assetHistories.forEach(({ holdings, history }) => {
      history.forEach(({ timestamp, price }) => {
        if (!timeTotals[timestamp]) timeTotals[timestamp] = 0;
        timeTotals[timestamp] += price * holdings;
      });
    });

    const portfolioHistory = Object.entries(timeTotals)
      .map(([timestamp, value]) => ({ timestamp: Number(timestamp), value }))
      .sort((a, b) => a.timestamp - b.timestamp);

    console.log(`返回数据点数: ${portfolioHistory.length}`);
    return NextResponse.json({ data: portfolioHistory });
  } catch (error) {
    console.error('获取投资组合历史失败', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}