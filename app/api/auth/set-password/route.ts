// /app/api/auth/set-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/neon';
import { getCurrentUserId } from '@/src/utils/assetStorage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    const phone = getCurrentUserId();

    if (!phone) {
      return NextResponse.json(
        { success: false, message: '未登录' },
        { status: 401 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { success: false, message: '密码至少6位' },
        { status: 400 }
      );
    }

    // 哈希新密码
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 更新或创建用户记录（UPSERT）
    await query(
      `
      INSERT INTO users (phone, password_hash, name, avatar_url, preferred_currency, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT (phone) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        updated_at = NOW()
      `,
      [
        phone,
        passwordHash,
        `用户${phone.slice(-4)}`, // 默认昵称
        '',                       // 默认头像
        'USD',                    // 默认货币
      ]
    );

    return NextResponse.json({ success: true, message: '密码设置成功' });
  } catch (error) {
    console.error('设置密码错误:', error);
    return NextResponse.json(
      { success: false, message: '服务器错误' },
      { status: 500 }
    );
  }
}