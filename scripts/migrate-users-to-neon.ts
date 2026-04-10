// scripts/migrate-users-to-neon.ts
import { MongoClient } from 'mongodb';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const MONGO_URI = process.env.MONGODB_URI;
const NEON_DB_URL = process.env.DATABASE_URL;  // 改用 DATABASE_URL

if (!MONGO_URI) {
  throw new Error('❌ 环境变量 MONGODB_URI 未定义，请检查 .env.local 文件');
}
if (!NEON_DB_URL) {
  throw new Error('❌ 环境变量 DATABASE_URL 未定义，请检查 .env.local 文件');
}

const mongoUri = MONGO_URI!;
const neonDbUrl = NEON_DB_URL!;

async function migrate() {
  const mongoClient = new MongoClient(mongoUri);
  const pgPool = new Pool({ connectionString: neonDbUrl });

  try {
    await mongoClient.connect();
    await pgPool.connect();

    const usersCollection = mongoClient.db().collection('users');
    const mongoUsers = await usersCollection.find({}).toArray();

    console.log(`找到 ${mongoUsers.length} 个 MongoDB 用户，开始迁移...`);

    for (const mUser of mongoUsers) {
      const phone = mUser.phone;
      const passwordHash = mUser.passwordHash || '';
      const name = mUser.name || `用户${phone.slice(-4)}`;
      const avatarUrl = mUser.avatarUrl || '';
      const preferredCurrency = mUser.preferredCurrency || 'USD';
      const createdAt = mUser.createdAt || new Date();
      const updatedAt = mUser.updatedAt || new Date();

      await pgPool.query(
        `
        INSERT INTO users (phone, password_hash, name, avatar_url, preferred_currency, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (phone) DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          name = EXCLUDED.name,
          avatar_url = EXCLUDED.avatar_url,
          preferred_currency = EXCLUDED.preferred_currency,
          updated_at = EXCLUDED.updated_at
        `,
        [phone, passwordHash, name, avatarUrl, preferredCurrency, createdAt, updatedAt]
      );
    }

    console.log('✅ 迁移完成！');
  } catch (error) {
    console.error('❌ 迁移失败:', error);
  } finally {
    await mongoClient.close();
    await pgPool.end();
  }
}

migrate();