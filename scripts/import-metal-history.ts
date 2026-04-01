import dotenv from 'dotenv';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

if (!process.env.POSTGRES_URL) {
  throw new Error('❌ POSTGRES_URL 未在 .env.local 中设置');
}

const execPromise = promisify(exec);

// 需要导入的贵金属品种列表
const METAL_SYMBOLS = [
  'Au100g',
  'Au(T+D)',
];

interface MetalRecord {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

async function importMetalHistory(symbol: string) {
  console.log(`\n🚀 开始导入 ${symbol} 历史数据...`);

  // 1. 调用 Python 脚本获取数据
  const pythonPath = path.join(process.cwd(), '.venv', 'bin', 'python');
  const scriptPath = path.join(process.cwd(), 'scripts', 'fetch_metal_history.py');
  const cmd = `"${pythonPath}" "${scriptPath}" "${symbol}"`;

  try {
    const { stdout, stderr } = await execPromise(cmd);
    if (stderr) {
      console.log('[Python 调试]', stderr);
    }

    const result = JSON.parse(stdout);
    if (!result.success) {
      console.error(`❌ ${symbol} 获取失败:`, result.error);
      return;
    }

    const records: MetalRecord[] = result.data;
    console.log(`✅ 获取到 ${records.length} 条数据，准备存入数据库...`);

    // 2. 连接数据库并保存
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(process.env.POSTGRES_URL!);

    // 确保表存在
    await sql`
      CREATE TABLE IF NOT EXISTS metal_price_history (
        symbol VARCHAR(50) NOT NULL,
        date DATE NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        change_percent DECIMAL(6,2),
        open DECIMAL(10,2),
        high DECIMAL(10,2),
        low DECIMAL(10,2),
        prev_close DECIMAL(10,2),
        volume DECIMAL(20,2),
        PRIMARY KEY (symbol, date)
      )
    `;

    // 3. 逐条插入（最安全，避免类型错误）
    let inserted = 0;
    for (const r of records) {
      await sql`
        INSERT INTO metal_price_history (symbol, date, price, change_percent, open, high, low, prev_close, volume)
        VALUES (${symbol}, ${r.date}, ${r.close}, 0, ${r.open}, ${r.high}, ${r.low}, NULL, ${r.volume})
        ON CONFLICT (symbol, date) DO UPDATE SET
          price = EXCLUDED.price,
          open = EXCLUDED.open,
          high = EXCLUDED.high,
          low = EXCLUDED.low,
          volume = EXCLUDED.volume
      `;
      inserted++;
      if (inserted % 100 === 0) {
        console.log(`  已保存 ${inserted}/${records.length} 条`);
      }
    }

    console.log(`✅ ${symbol} 历史数据导入完成 (${records.length} 条)`);
  } catch (error) {
    console.error(`❌ ${symbol} 导入失败:`, error);
  }
}

async function main() {
  console.log('开始批量导入贵金属历史数据...');
  for (const symbol of METAL_SYMBOLS) {
    await importMetalHistory(symbol);
    // 避免请求过快
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  console.log('\n🎉 全部完成');
}

main().catch(console.error);