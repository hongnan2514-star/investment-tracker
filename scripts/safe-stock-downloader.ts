// scripts/safe-stock-downloader.ts
import { neon } from '@neondatabase/serverless';
import axios, { AxiosRequestConfig } from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { config } from 'dotenv';
import schedule from 'node-schedule';

config({ path: '.env.local' });

// ==================== 配置 ====================
const PROXY_URL = 'http://your-proxy-address:port'; // 仍保留代理选项，若不使用请留空
const PROXY_AUTH = 'username:password'; 
const SYMBOLS = [ 'INTC' ]; // 'AAPL', 'MSFT', 'GOOGL', 'NVDA' 已下载
const RESOLUTIONS = ['1d'] as const; // Tiingo免费套餐主要支持日线，先只下载日线
type Resolution = typeof RESOLUTIONS[number];
const LIMITS: Record<Resolution, number> = { '1d': 365 }; // 这个 limit 现在作为每次拉取的最大条数限制（安全上限）

// Tiingo Token
const TIINGO_TOKEN = process.env.TIINGO_TOKEN;
if (!TIINGO_TOKEN) {
  throw new Error("请在 .env.local 中设置 TIINGO_TOKEN");
}

// ==================== 代理（可选） ====================
class ProxyManager {
  private agent: HttpsProxyAgent<string> | undefined;

  constructor(proxyUrl: string, auth?: string) {
    if (proxyUrl && proxyUrl !== 'http://your-proxy-address:port') {
      const fullUrl = auth ? proxyUrl.replace('://', `://${auth}@`) : proxyUrl;
      this.agent = new HttpsProxyAgent(fullUrl);
    } else {
      console.warn('⚠️ 代理未配置，将使用本地 IP');
    }
  }

  getAgent() {
    return this.agent;
  }
}
const proxyManager = new ProxyManager(PROXY_URL, PROXY_AUTH);

// ==================== 速率限制器 ====================
class RateLimiter {
  private queue: (() => Promise<any>)[] = [];
  private running = false;
  private minInterval = 2000;   // 2秒
  private maxInterval = 5000;   // 5秒

  async add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await task();
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
      if (!this.running) this.process();
    });
  }

  private async process() {
    this.running = true;
    while (this.queue.length) {
      const task = this.queue.shift();
      if (task) await task();
      const waitTime = this.minInterval + Math.random() * (this.maxInterval - this.minInterval);
      console.log(`⏳ 等待 ${(waitTime/1000).toFixed(1)} 秒后执行下一个请求...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    this.running = false;
  }
}
const rateLimiter = new RateLimiter();

// ==================== 重试（用于 API 请求） ====================
async function fetchWithRetry(url: string, retries = 3): Promise<any> {
  const config: AxiosRequestConfig = {
    httpsAgent: proxyManager.getAgent(),
    timeout: 30000,
  };

  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get(url, config);
      if (response.status === 200) return response.data;
      throw new Error(`HTTP ${response.status}`);
    } catch (error: any) {
      const delay = 5000 * Math.pow(2, i) + Math.random() * 2000;
      console.log(`⏳ 请求失败 (${error.message}), 等待 ${(delay/1000).toFixed(1)} 秒后重试 (${i + 1}/${retries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      if (i === retries - 1) throw error;
    }
  }
}

// ==================== 数据库操作（带重试） ====================
const sql = neon(process.env.POSTGRES_URL!);

/**
 * 查询某股票在 stock_price_history 表中的最新日期
 */
async function getLatestStockDate(symbol: string): Promise<string | null> {
  try {
    const result = await sql`
      SELECT date FROM stock_price_history 
      WHERE symbol = ${symbol}
      ORDER BY date DESC LIMIT 1
    `;
    return result[0]?.date || null;
  } catch (error) {
    console.error(`查询最新日期失败 ${symbol}:`, error);
    return null; // 失败时返回 null，后续将拉取全量
  }
}

/**
 * 保存日线数据（带重试）
 */
async function saveDailyDataWithRetry(symbol: string, records: OHLCV[], retries = 3): Promise<void> {
  if (records.length === 0) return;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const batchSize = 500;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const promises = batch.map(r => sql`
          INSERT INTO stock_price_history (symbol, date, open, high, low, close, volume)
          VALUES (${symbol}, ${new Date(r.timestamp * 1000).toISOString().split('T')[0]}, ${r.open}, ${r.high}, ${r.low}, ${r.close}, ${r.volume})
          ON CONFLICT (symbol, date) DO UPDATE SET
            open = EXCLUDED.open,
            high = EXCLUDED.high,
            low = EXCLUDED.low,
            close = EXCLUDED.close,
            volume = EXCLUDED.volume
        `);
        await Promise.all(promises);
      }
      console.log(`      💾 已保存 ${records.length} 条日线数据`);
      return; // 成功则返回
    } catch (error) {
      console.error(`保存数据失败 (尝试 ${attempt + 1}/${retries}):`, error);
      if (attempt === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 5000 * Math.pow(2, attempt)));
    }
  }
}

// ==================== 数据获取（Tiingo） ====================
interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * 获取日线数据，支持从指定日期开始
 * @param symbol 股票代码
 * @param sinceDate 可选，起始日期 (YYYY-MM-DD)，只拉取该日期之后的数据
 * @param limit 最大条数限制（安全上限）
 */
async function fetchStockDailyHistory(symbol: string, sinceDate?: string, limit: number = 365): Promise<OHLCV[] | null> {
  const toDate = new Date();
  let fromDate: Date;
  if (sinceDate) {
    fromDate = new Date(sinceDate);
    // 为了避免拉取到重复的当天数据（如果数据库已有当天数据，可以+1天），但 Tiingo 的 startDate 是包含的，所以直接用 sinceDate
    // 如果数据库已有当天数据，想要避免重复，可以在调用时传入下一天，但简单起见直接传入 sinceDate，由 ON CONFLICT 处理重复。
  } else {
    fromDate = new Date();
    fromDate.setFullYear(fromDate.getFullYear() - 30); // 默认拉取 30 年
  }

  const fromStr = fromDate.toISOString().split('T')[0];
  const toStr = toDate.toISOString().split('T')[0];

  const url = `https://api.tiingo.com/tiingo/daily/${symbol}/prices?startDate=${fromStr}&endDate=${toStr}&format=json&token=${TIINGO_TOKEN}`;
  console.log(`  请求 Tiingo URL: ${url.replace(TIINGO_TOKEN!, 'HIDDEN')}`);

  try {
    const data = await fetchWithRetry(url);
    if (!Array.isArray(data)) {
      console.warn(`    ${symbol} 日线数据格式错误`);
      return null;
    }

    const ohlcv: OHLCV[] = data.map((item: any) => ({
      timestamp: Math.floor(new Date(item.date).getTime() / 1000),
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volume,
    }));

    // Tiingo 返回的数据通常是降序（最新在前），反转得到升序
    return ohlcv.reverse();
  } catch (error) {
    console.error(`Tiingo 请求失败 ${symbol}:`, error);
    return null;
  }
}

// ==================== 核心下载逻辑（增量更新） ====================
export async function downloadAll() {
  console.log('🚀 开始执行批量下载任务');
  for (const symbol of SYMBOLS) {
    console.log(`开始处理 ${symbol}`);
    for (const res of RESOLUTIONS) {
      const limit = LIMITS[res];
      console.log(`  检查 ${symbol} 的 ${res} 数据...`);

      // 查询数据库中最新的日期
      const latestDate = await getLatestStockDate(symbol);
      if (latestDate) {
        console.log(`    数据库中最新日期: ${latestDate}`);
      } else {
        console.log(`    数据库中无历史数据，将拉取全量`);
      }

      // 计算起始日期：如果 latestDate 存在，则从下一天开始拉取，避免重复当天的数据（如果当天数据已存在）
      let sinceDate: string | undefined;
      if (latestDate) {
        const nextDay = new Date(latestDate);
        nextDay.setDate(nextDay.getDate() + 1);
        sinceDate = nextDay.toISOString().split('T')[0];
      }

      const data = await rateLimiter.add(() => fetchStockDailyHistory(symbol, sinceDate, limit));

      if (data && data.length > 0) {
        await saveDailyDataWithRetry(symbol, data);
        console.log(`  ✅ 保存 ${data.length} 条新数据`);
      } else {
        console.log(`  ⚠️ 无新数据`);
      }
    }
  }
  console.log('🎉 全部下载任务完成！');
}

// ==================== 定时任务 ====================
const job = schedule.scheduleJob('0 12 * * 0', async () => {
  console.log('⏰ 定时任务触发：每周日12:00开始下载股票数据');
  try {
    await downloadAll();
  } catch (err) {
    console.error('定时任务执行失败:', err);
  }
});

console.log('✅ 定时任务已设置，将在每周日12:00自动执行下载。');

if (require.main === module) {
  console.log('🔄 直接运行模式，立即开始下载...');
  downloadAll().catch(console.error);
}