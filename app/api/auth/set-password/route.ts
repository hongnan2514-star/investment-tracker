// /app/api/auth/set-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import User from '@/models/User';
import connectDB from '@/lib/mongoose';
import { getCurrentUserId } from '@/src/utils/assetStorage'; // 假设有获取当前登录用户ID的工具

export const dynamic = 'force-dynamic'; // 强制动态路由，确保每次请求都执行服务器端逻辑
export const runtime = 'nodejs'; // 明确指定使用 Node.js 运行时

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    const phone = getCurrentUserId(); // 从会话中获取手机号（需要实现）

    if (!phone) {
      return NextResponse.json({ success: false, message: '未登录' }, { status: 401 });
    }

    if (!password || password.length < 6) {
      return NextResponse.json({ success: false, message: '密码至少6位' }, { status: 400 });
    }

    await connectDB();

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    await User.findOneAndUpdate(
      { phone },
      { passwordHash, updatedAt: new Date() },
      { upsert: true } // 如果用户不存在则创建
    );

    return NextResponse.json({ success: true, message: '密码设置成功' });
  } catch (error) {
    console.error('设置密码错误:', error);
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 });
  }
}