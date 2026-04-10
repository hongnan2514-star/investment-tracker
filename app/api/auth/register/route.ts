// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/neon'; // 替换原来的 mongoose 连接

export async function POST(req: NextRequest) {
  try {
    const { phoneNumber, password } = await req.json();

    if (!phoneNumber || !password || password.length < 6) {
      return NextResponse.json(
        { success: false, message: '手机号和密码（至少6位）不能为空' },
        { status: 400 }
      );
    }

    // 检查用户是否已存在（查询 Neon）
    const existing = await query('SELECT phone FROM users WHERE phone = $1', [phoneNumber]);
    if (existing.rowCount && existing.rowCount > 0) {
      return NextResponse.json(
        { success: false, message: '该手机号已注册' },
        { status: 400 }
      );
    }

    // 加密密码
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 生成默认名称
    const defaultName = `用户${phoneNumber.slice(-4)}`;

    // 插入新用户
    const result = await query(
      `
      INSERT INTO users (phone, password_hash, name, avatar_url, preferred_currency)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING phone, name, avatar_url, preferred_currency
      `,
      [phoneNumber, passwordHash, defaultName, '', 'USD']
    );

    const newUser = result.rows[0];

    return NextResponse.json({ success: true, user: newUser });
  } catch (error) {
    console.error('注册错误:', error);
    return NextResponse.json(
      { success: false, message: '服务器错误' },
      { status: 500 }
    );
  }
}