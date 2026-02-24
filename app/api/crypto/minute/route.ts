import { NextRequest } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'fund_history.db');

if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

const db = new Database(DB_PATH);

// 确保分钟级数据表存在（如果尚未创建）
db.exec(`
  CREATE TABLE IF NOT EXISTS crypto_minute_history (
    symbol TEXT,
    timestamp INTEGER,
    resolution TEXT,
    open REAL,
    high REAL,
    low REAL,
    close REAL,
    volume REAL,
    PRIMARY KEY (symbol, timestamp, resolution)
  );
  CREATE INDEX IF NOT EXISTS idx_crypto_minute_symbol_time 
  ON crypto_minute_history(symbol, timestamp DESC);
`);

// GET：获取分钟级数据
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol');
  const resolution = searchParams.get('resolution');
  const limit = parseInt(searchParams.get('limit') || '288');

  if (!symbol || !resolution) {
    return Response.json({ error: '缺少参数 symbol 或 resolution' }, { status: 400 });
  }

  try {
    const stmt = db.prepare(`
      SELECT * FROM crypto_minute_history
      WHERE symbol = ? AND resolution = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    const data = stmt.all(symbol, resolution, limit);
    return Response.json(data);
  } catch (error) {
    console.error('获取分钟数据失败:', error);
    return Response.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

// POST：保存分钟级数据
export async function POST(request: NextRequest) {
  try {
    const records = await request.json();
    if (!Array.isArray(records) || records.length === 0) {
      return Response.json({ error: '请求体应为非空数组' }, { status: 400 });
    }

    const insert = db.prepare(`
      INSERT OR REPLACE INTO crypto_minute_history 
      (symbol, timestamp, resolution, open, high, low, close, volume)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((records) => {
      for (const r of records) {
        insert.run(
          r.symbol,
          r.timestamp,
          r.resolution,
          r.open,
          r.high,
          r.low,
          r.close,
          r.volume
        );
      }
    });

    transaction(records);
    return Response.json({ success: true, count: records.length });
  } catch (error) {
    console.error('保存分钟数据失败:', error);
    return Response.json({ error: '服务器内部错误' }, { status: 500 });
  }
}