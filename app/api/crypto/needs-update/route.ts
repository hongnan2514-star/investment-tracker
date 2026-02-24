// app/api/crypto/need-update/route.ts
import { NextRequest } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'fund_history.db');

if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

const db = new Database(DB_PATH);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol');          // 交易对，如 "BTC/USDT"
  const resolution = searchParams.get('resolution');  // 分辨率，如 "5m"
  const maxAgeSeconds = parseInt(searchParams.get('maxAge') || '300'); // 默认5分钟

  if (!symbol || !resolution) {
    return Response.json({ error: '缺少参数 symbol 或 resolution' }, { status: 400 });
  }

  try {
    const stmt = db.prepare(`
      SELECT timestamp FROM crypto_minute_history
      WHERE symbol = ? AND resolution = ?
      ORDER BY timestamp DESC LIMIT 1
    `);
    const row = stmt.get(symbol, resolution) as { timestamp: number } | undefined;

    if (!row) {
      // 没有数据，需要更新
      return Response.json({ needsUpdate: true });
    }

    const lastTime = row.timestamp * 1000; // 秒转毫秒
    const now = Date.now();
    const needsUpdate = (now - lastTime) > maxAgeSeconds * 1000;
    return Response.json({ needsUpdate });
  } catch (error) {
    console.error('检查更新状态失败:', error);
    return Response.json({ error: '服务器内部错误' }, { status: 500 });
  }
}