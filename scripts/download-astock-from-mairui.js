// scripts/download-astock-from-mairui.js
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载 .env.local
config({ path: path.resolve(__dirname, '../.env.local') });

// 调试输出（可选）
console.log('POSTGRES_URL:', process.env.POSTGRES_URL);
console.log('MAIRUI_LICENCE:', process.env.MAIRUI_LICENCE);

import { neon } from '@neondatabase/serverless';
import fetch from 'node-fetch';

const MAIRUI_LICENCE = process.env.MAIRUI_LICENCE;
const sql = neon(process.env.POSTGRES_URL);

// ========== 确保表存在 ==========
async function ensureTables() {
  console.log('检查并创建表...');
  // 分钟表
  await sql`
    CREATE TABLE IF NOT EXISTS stock_minute_history (
      symbol TEXT NOT NULL,
      timestamp BIGINT NOT NULL,
      resolution TEXT NOT NULL,
      open NUMERIC,
      high NUMERIC,
      low NUMERIC,
      close NUMERIC,
      volume NUMERIC,
      PRIMARY KEY (symbol, timestamp, resolution)
    )
  `;
  // 日线表
  await sql`
    CREATE TABLE IF NOT EXISTS stock_price_history (
      symbol TEXT NOT NULL,
      date DATE NOT NULL,
      open NUMERIC,
      high NUMERIC,
      low NUMERIC,
      close NUMERIC,
      volume NUMERIC,
      PRIMARY KEY (symbol, date)
    )
  `;
  // 月线表
  await sql`
    CREATE TABLE IF NOT EXISTS stock_monthly_history (
      symbol TEXT NOT NULL,
      date DATE NOT NULL,
      open NUMERIC,
      high NUMERIC,
      low NUMERIC,
      close NUMERIC,
      volume NUMERIC,
      PRIMARY KEY (symbol, date)
    )
  `;
  console.log('表检查完成。');
}

// ========== 常见股票列表（可自行扩展） ==========
const COMMON_STOCKS = [
  '159859.SZ',
];

// 需要下载的分辨率列表
const RESOLUTIONS = [
  { name: '15m', apiParam: '15m', table: 'minute' },
  { name: '30m', apiParam: '30m', table: 'minute' },
  { name: '1h',  apiParam: '60m', table: 'minute' },
  { name: '1d',  apiParam: 'dn',  table: 'daily' },
  // 月线从日线聚合，不直接下载
];

const BATCH_SIZE = 50; // 每天最多处理50个任务

// ========== 获取待下载任务 ==========
async function getTasksToDownload(limit = BATCH_SIZE) {
  const tasks = [];
  for (const symbol of COMMON_STOCKS) {
    for (const res of RESOLUTIONS) {
      try {
        let tableName = res.table === 'minute' ? 'stock_minute_history' : 'stock_price_history';
        let result;
        
        if (res.table === 'minute') {
          console.log(`检查 ${symbol} ${res.name} 是否在 ${tableName} 表中...`);
          result = await sql.query(
            `SELECT 1 FROM ${tableName} WHERE symbol = $1 AND resolution = $2 LIMIT 1`,
            [symbol, res.name]
          );
        } else {
          console.log(`检查 ${symbol} 日线是否在 ${tableName} 表中...`);
          result = await sql.query(
            `SELECT 1 FROM ${tableName} WHERE symbol = $1 LIMIT 1`,
            [symbol]
          );
        }
        
        console.log(`查询结果:`, JSON.stringify(result, null, 2));
        
        // 安全地检查结果
        if (result && Array.isArray(result.rows) && result.rows.length === 0) {
          tasks.push({ symbol, ...res });
          if (tasks.length >= limit) break;
        } else if (!result || !result.rows) {
          console.warn(`[警告] 查询返回了意外的结果结构，视为未下载: ${symbol} ${res.name}`);
          tasks.push({ symbol, ...res });
          if (tasks.length >= limit) break;
        }
      } catch (err) {
        console.error(`查询失败: ${symbol} ${res.name}`, err);
        // 如果查询失败，我们保守地认为需要下载
        tasks.push({ symbol, ...res });
        if (tasks.length >= limit) break;
      }
    }
    if (tasks.length >= limit) break;
  }
  return tasks;
}

// ========== 下载并保存单任务 ==========
async function downloadAndSave(task) {
  const { symbol, name, apiParam, table } = task;
  const code = symbol.split('.')[0]; // 去掉后缀
  const url = `http://api.mairui.club/hszbl/fsjy/${code}/${apiParam}/${MAIRUI_LICENCE}`;
  
  console.log(`[${symbol} | ${name}] 请求: ${url}`);
  
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`[${symbol}] HTTP错误 ${res.status}`);
      return false;
    }
    
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      console.error(`[${symbol}] 返回数据为空`);
      return false;
    }
    
    if (table === 'minute') {
      await saveMinuteData(symbol, name, data);
    } else if (table === 'daily') {
      await saveDailyData(symbol, data);
    }
    
    console.log(`[${symbol} | ${name}] 成功保存 ${data.length} 条数据`);
    return true;
  } catch (error) {
    console.error(`[${symbol}] 异常:`, error.message);
    return false;
  }
}

// 保存分钟数据到 stock_minute_history
async function saveMinuteData(symbol, resolution, data) {
  for (const item of data) {
    const dateStr = item.d.replace(/-/g, '/');
    const timestamp = Math.floor(new Date(dateStr).getTime() / 1000);
    
    await sql`
      INSERT INTO stock_minute_history 
        (symbol, timestamp, resolution, open, high, low, close, volume)
      VALUES (
        ${symbol}, 
        ${timestamp}, 
        ${resolution},
        ${parseFloat(item.o)}, 
        ${parseFloat(item.h)}, 
        ${parseFloat(item.l)}, 
        ${parseFloat(item.c)}, 
        ${parseFloat(item.v) || 0}
      )
      ON CONFLICT (symbol, timestamp, resolution) DO NOTHING
    `;
  }
}

// 保存日线数据到 stock_price_history
async function saveDailyData(symbol, data) {
  for (const item of data) {
    const dateStr = item.d; // 格式 "2026-03-08"
    await sql`
      INSERT INTO stock_price_history 
        (symbol, date, open, high, low, close, volume)
      VALUES (
        ${symbol},
        ${dateStr},
        ${parseFloat(item.o)},
        ${parseFloat(item.h)},
        ${parseFloat(item.l)},
        ${parseFloat(item.c)},
        ${parseFloat(item.v) || 0}
      )
      ON CONFLICT (symbol, date) DO NOTHING
    `;
  }
}

// ========== 主函数 ==========
async function main() {
  // 先确保表存在
  await ensureTables();
  
  console.log('开始获取待下载任务...');
  const tasks = await getTasksToDownload(BATCH_SIZE);
  console.log(`本次计划处理 ${tasks.length} 个任务`);
  if (tasks.length === 0) {
    console.log('没有需要下载的任务，退出。');
    process.exit(0);
  }

  let success = 0;
  for (let i = 0; i < tasks.length; i++) {
    console.log(`\n进度 ${i+1}/${tasks.length}`);
    const ok = await downloadAndSave(tasks[i]);
    if (ok) success++;
    await new Promise(r => setTimeout(r, 500)); // 礼貌延迟
  }

  console.log(`\n完成！成功 ${success}/${tasks.length} 个任务。`);
  process.exit(0);
}

main().catch(err => {
  console.error('脚本执行失败:', err);
  process.exit(1);
});