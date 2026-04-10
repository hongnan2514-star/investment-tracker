// lib/neon.ts
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,  // 改为 DATABASE_URL
});

export const query = (text: string, params?: any[]) => pool.query(text, params);