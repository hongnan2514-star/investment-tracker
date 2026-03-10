// app/api/data-sources/sina-stock.ts
import { StockMinute } from '@/src/services/fundHistoryDB';

/**
 * 将带后缀的代码转换为新浪格式（如 600519.SS -> sh600519）
 */
function convertToSinaSymbol(symbol: string): string | null {
  const match = symbol.match(/^(\d{6})\.(SS|SZ)$/);
  if (!match) return null;
  const code = match[1];
  const market = match[2];
  return market === 'SS' ? `sh${code}` : `sz${code}`;
}

/**
 * 从新浪财经获取股票分钟 K 线数据
 * @param symbol 带后缀的代码，如 "600519.SS"
 * @param resolution 分辨率，支持 '15m', '30m', '60m'（1h）
 * @param limit 最多获取条数（新浪最大 1023）
 * @param sinceTimestamp 可选，起始时间戳（毫秒），用于过滤
 */
export async function fetchAStockMinuteDataFromSina(
  symbol: string,
  resolution: string,
  limit: number = 288,
  sinceTimestamp?: number
): Promise<StockMinute[]> {
  const sinaSymbol = convertToSinaSymbol(symbol);
  if (!sinaSymbol) {
    console.log(`[新浪] 非A股代码: ${symbol}，跳过`);
    return [];
  }

  // 分辨率映射到新浪 scale 参数（分钟数）
  const scaleMap: Record<string, number> = {
    '15m': 15,
    '30m': 30,
    '60m': 60,
    '1h': 60,
  };
  const scale = scaleMap[resolution];
  if (!scale) {
    console.log(`[新浪] 不支持的分辨率: ${resolution}`);
    return [];
  }

  const url = `https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?symbol=${sinaSymbol}&scale=${scale}&ma=no&datalen=${Math.min(limit, 1023)}`;
  console.log(`[新浪] 请求: ${url}`);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://finance.sina.com.cn/',
      },
    });
    if (!res.ok) {
      console.error(`[新浪] HTTP error! status: ${res.status}`);
      return [];
    }

    const text = await res.text();
    let data: any[];
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error(`[新浪] JSON 解析失败:`, text.slice(0, 200));
      return [];
    }

    if (!Array.isArray(data)) {
      console.error(`[新浪] 返回数据不是数组`);
      return [];
    }

    const records: StockMinute[] = [];
    for (const item of data) {
      const dateStr = item.day; // 格式 "2025-03-07 14:45:00"
      if (!dateStr) continue;

      const timestamp = Math.floor(new Date(dateStr.replace(/-/g, '/')).getTime() / 1000);
      if (sinceTimestamp && timestamp * 1000 < sinceTimestamp) continue;

      const open = parseFloat(item.open);
      const high = parseFloat(item.high);
      const low = parseFloat(item.low);
      const close = parseFloat(item.close);
      const volume = parseFloat(item.volume) || 0;

      if (isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close)) continue;

      records.push({
        symbol,
        timestamp,
        resolution,
        open,
        high,
        low,
        close,
        volume,
      });
    }

    // 新浪返回的数据可能是最新在前，按时间升序排序
    records.sort((a, b) => a.timestamp - b.timestamp);
    console.log(`[新浪] 获取到 ${records.length} 条 ${resolution} 数据`);
    return records;
  } catch (error) {
    console.error('[新浪] 请求异常:', error);
    return [];
  }
}