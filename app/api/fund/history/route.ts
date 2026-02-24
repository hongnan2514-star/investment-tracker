import { NextRequest } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// 数据库文件路径（与 fundHistoryDB.ts 保持一致）
const DB_PATH = path.join(process.cwd(), 'data', 'fund_history.db');

// 确保 data 目录存在
if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

// 打开数据库（better-sqlite3 仅在服务器端运行）
const db = new Database(DB_PATH);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');          // 基金代码
  const days = parseInt(searchParams.get('days') || '365');

  if (!code) {
    return Response.json({ error: '缺少基金代码' }, { status: 400 });
  }

  try {
    const stmt = db.prepare(`
      SELECT * FROM fund_nav_history 
      WHERE code = ? 
      AND date >= date('now', ?)
      ORDER BY date ASC
    `);
    const data = stmt.all(code, `-${days} days`);
    return Response.json(data);
  } catch (error) {
    console.error('查询基金历史失败:', error);
    return Response.json({ error: '服务器内部错误' }, { status: 500 });
  }
}