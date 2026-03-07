import { neon } from '@neondatabase/serverless';
import axios, { AxiosRequestConfig } from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { config } from 'dotenv';
import schedule from 'node-schedule';

// 加载环境变量
config({ path: '.env.local' });

// ==================== 配置 ====================
// 代理设置（如需使用请填写，否则留空）
const PROXY_URL = ''; // 例如 'http://proxy.example.com:8080'
const PROXY_AUTH = ''; // 例如 'username:password'

// 股票代码列表（可自行修改或通过命令行参数传入）
const SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA', 'NKE']; // 示例列表

// Tiingo Token
const TIINGO_TOKEN = process.env.TIINGO_TOKEN;
if (!TIINGO_TOKEN) {
  throw new Error("请在 .env.local 中设置 TIINGO_TOKEN");
}

// ==================== 代理管理器（可选） ====================
class ProxyManager {
  private agent: HttpsProxyAgent<string> | undefined;

  constructor(proxyUrl: string, auth?: string) {
    if (proxyUrl && proxyUrl.trim() !== '') {
      const fullUrl = auth ? proxyUrl.replace('://', `://${auth}@`) : proxyUrl;
      this.agent = new HttpsProxyAgent(fullUrl);
      console.log('🔌 代理已启用');
    } else {
      console.log('🌐 未配置代理，将直接连接');
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

// ==================== 数据库连接 ====================
const sql = neon(process.env.POSTGRES_URL!);

// ==================== 工具函数 ====================
/**
 * 获取某股票在 stock_monthly_history 表中的最新日期
 */
async function getLatestMonthlyDate(symbol: string): Promise<string | null> {
  try {
    const result = await sql`
      SELECT date FROM stock_monthly_history 
      WHERE symbol = ${symbol}
      ORDER BY date DESC LIMIT 1
    `;
    return result[0]?.date ? new Date(result[0].date).toISOString().split('T')[0] : null;
  } catch (error) {
    console.error(`查询最新日期失败 ${symbol}:`, error);
    return null;
  }
}

/**
 * 保存月线数据（批量 upsert）
 */
async function saveMonthlyData(symbol: string, records: any[]): Promise<void> {
  if (records.length === 0) return;
  try {
    const batchSize = 500;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const promises = batch.map(r => sql`
        INSERT INTO stock_monthly_history (symbol, date, open, high, low, close, volume)
        VALUES (
          ${symbol}, 
          ${r.date}, 
          ${r.open}, 
          ${r.high}, 
          ${r.low}, 
          ${r.close}, 
          ${r.volume}
        )
        ON CONFLICT (symbol, date) DO UPDATE SET
          open = EXCLUDED.open,
          high = EXCLUDED.high,
          low = EXCLUDED.low,
          close = EXCLUDED.close,
          volume = EXCLUDED.volume
      `);
      await Promise.all(promises);
    }
    console.log(`      💾 已保存 ${records.length} 条月线数据`);
  } catch (error) {
    console.error(`保存数据失败:`, error);
    throw error;
  }
}

// ==================== 从 Tiingo 获取月线数据 ====================
interface OHLCV {
  date: string;        // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * 获取股票的月线数据
 * @param symbol 股票代码
 * @param startDate 起始日期 (YYYY-MM-DD)，如果为 null 则拉取尽可能多的历史（例如 30 年）
 */
async function fetchStockMonthlyFromTiingo(symbol: string, startDate: string | null): Promise<OHLCV[] | null> {
  // 构建日期范围
  const toDate = new Date();
  let fromDate: Date;
  if (startDate) {
    fromDate = new Date(startDate);
  } else {
    fromDate = new Date();
    fromDate.setFullYear(fromDate.getFullYear() - 30); // 默认拉取 30 年
  }

  const fromStr = fromDate.toISOString().split('T')[0];
  const toStr = toDate.toISOString().split('T')[0];

  // Tiingo 月线参数：resampleFreq=monthly
  const url = `https://api.tiingo.com/tiingo/daily/${symbol}/prices?startDate=${fromStr}&endDate=${toStr}&resampleFreq=monthly&format=json&token=${TIINGO_TOKEN}`;
  console.log(`  请求 Tiingo URL: ${url.replace(TIINGO_TOKEN!, 'HIDDEN')}`);

  try {
    const data = await fetchWithRetry(url);
    if (!Array.isArray(data)) {
      console.warn(`    ${symbol} 月线数据格式错误`);
      return null;
    }

    // Tiingo 返回的数据通常是降序（最新在前），我们反转得到升序
    const ohlcv: OHLCV[] = data.map((item: any) => ({
      date: item.date.split('T')[0], // 只保留日期部分
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volume,
    })).reverse();

    return ohlcv;
  } catch (error) {
    console.error(`Tiingo 请求失败 ${symbol}:`, error);
    return null;
  }
}

// ==================== 主下载逻辑（增量更新） ====================
export async function downloadMonthlyForSymbol(symbol: string) {
  console.log(`\n📈 处理 ${symbol} 月线数据...`);

  // 查询数据库中该股票的最新日期
  const latestDate = await getLatestMonthlyDate(symbol);
  if (latestDate) {
    console.log(`  数据库中最新日期: ${latestDate}`);
  } else {
    console.log(`  数据库中无历史月线数据，将拉取全量`);
  }

  // 计算起始日期：如果 latestDate 存在，则从下一天开始拉取，避免重复
  let startDate: string | null = null;
  if (latestDate) {
    const nextDay = new Date(latestDate);
    nextDay.setDate(nextDay.getDate() + 1);
    startDate = nextDay.toISOString().split('T')[0];
    console.log(`  增量起始日期: ${startDate}`);
  }

  // 通过速率限制器发起请求
  const data = await rateLimiter.add(() => fetchStockMonthlyFromTiingo(symbol, startDate));

  if (data && data.length > 0) {
    console.log(`  获取到 ${data.length} 条新月线数据`);
    await saveMonthlyData(symbol, data);
    console.log(`  ✅ ${symbol} 月线数据更新完成`);
  } else {
    console.log(`  ⚠️ ${symbol} 无新数据`);
  }
}

export async function downloadAll() {
  console.log('🚀 开始执行股票月线批量下载任务');
  for (const symbol of SYMBOLS) {
    try {
      await downloadMonthlyForSymbol(symbol);
    } catch (error) {
      console.error(`处理 ${symbol} 时发生错误:`, error);
    }
  }
  console.log('🎉 全部下载任务完成！');
}

// ==================== 定时任务（可选） ====================
// 每月1号中午12点执行一次
const job = schedule.scheduleJob('0 12 1 * *', async () => {
  console.log('⏰ 定时任务触发：每月1号12:00开始下载股票月线数据');
  try {
    await downloadAll();
  } catch (err) {
    console.error('定时任务执行失败:', err);
  }
});

console.log('✅ 定时任务已设置，将在每月1号12:00自动执行下载。');

// ==================== 直接运行 ====================
if (require.main === module) {
  console.log('🔄 直接运行模式，立即开始下载...');
  downloadAll().catch(console.error);
}