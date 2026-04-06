// src/lib/db.ts
import { Pool } from 'pg';

// 确保连接字符串正确且没有多余空格或换行
const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) {
  throw new Error('DATABASE_URL is not defined in environment variables');
}

console.log('Connecting to database with URL:', connectionString.replace(/:[^:@]*@/, ':****@')); // 隐藏密码

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }, // 可选，根据 Neon 要求
});

export const query = (text: string, params?: any[]) => pool.query(text, params);
export const getDb = () => ({ query });