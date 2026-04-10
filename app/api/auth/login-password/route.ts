// /app/api/auth/login-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/neon';
import { setCurrentUserId } from '@/src/utils/assetStorage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { phone, password } = await req.json();

    if (!phone || !password) {
      return NextResponse.json(
        { success: false, message: '手机号和密码不能为空' },
        { status: 400 }
      );
    }

    // 从 Neon 查询用户
    const userResult = await query(
      `SELECT phone, password_hash, name, avatar_url, preferred_currency 
       FROM users WHERE phone = $1`,
      [phone]
    );

    if (userResult.rowCount === 0) {
      return NextResponse.json(
        { success: false, message: '手机号或密码错误' },
        { status: 401 }
      );
    }

    const user = userResult.rows[0];

    // 检查密码哈希是否存在
    if (!user.password_hash) {
      return NextResponse.json(
        { success: false, message: '手机号或密码错误' },
        { status: 401 }
      );
    }

    // 验证密码
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json(
        { success: false, message: '手机号或密码错误' },
        { status: 401 }
      );
    }

    // 设置当前用户 ID（保持原逻辑不变）
    setCurrentUserId(phone); // 不等待

    return NextResponse.json({
      success: true,
      user: {
        phone: user.phone,
        name: user.name || `用户${phone.slice(-4)}`,
        avatarUrl: user.avatar_url || '',
        preferredCurrency: user.preferred_currency || 'USD',
      },
    });
  } catch (error) {
    console.error('密码登录错误:', error);
    return NextResponse.json(
      { success: false, message: '服务器错误' },
      { status: 500 }
    );
  }
}