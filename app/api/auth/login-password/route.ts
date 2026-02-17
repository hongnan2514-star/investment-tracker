// /app/api/auth/login-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import User from '@/models/User';
import connectDB from '@/lib/mongoose';
import { setCurrentUserId } from '@/src/utils/assetStorage'; // 用于登录后设置用户ID

export const dynamic = 'force-dynamic'; // 强制动态路由，确保每次请求都执行服务器端逻辑

export async function POST(req: NextRequest) {
  try {
    const { phone, password } = await req.json();

    if (!phone || !password) {
      return NextResponse.json({ success: false, message: '手机号和密码不能为空' }, { status: 400 });
    }

    await connectDB();

    const user = await User.findOne({ phone });
    if (!user || !user.passwordHash) {
      return NextResponse.json({ success: false, message: '手机号或密码错误' }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ success: false, message: '手机号或密码错误' }, { status: 401 });
    }

    // 登录成功，设置会话
    setCurrentUserId(phone); // 与短信登录保持一致

    return NextResponse.json({
      success: true,
      user: { phone, name: `用户${phone.slice(-4)}` } // 可扩展
    });
  } catch (error) {
    console.error('密码登录错误:', error);
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 });
  }
}