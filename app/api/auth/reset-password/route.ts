// /app/api/auth/reset-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import User from '@/models/User';
import connectDB from '@/lib/mongoose';
import Otp from '@/models/Otp'; // 需要验证码模型
import bcrypt from 'bcryptjs'; // 使用 bcryptjs 以兼容 Node.js 运行时

export const dynamic = 'force-dynamic'; // 强制动态路由，确保每次请求都执行服务器端逻辑
export const runtime = 'nodejs'; // 明确指定使用 Node.js 运行时

export async function POST(req: NextRequest) {
  try {
    const { phone, otp, newPassword } = await req.json();

    if (!phone || !otp || !newPassword) {
      return NextResponse.json({ success: false, message: '参数缺失' }, { status: 400 });
    }

    await connectDB();

    // 验证验证码
    const record = await Otp.findOne({ phoneNumber: phone }).sort({ createdAt: -1 });
    if (!record || record.otp !== otp) {
      return NextResponse.json({ success: false, message: '验证码错误' }, { status: 400 });
    }
    // 验证码有效，删除已使用的验证码
    await Otp.deleteOne({ _id: record._id });

    // 更新密码
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    await User.findOneAndUpdate(
      { phone },
      { passwordHash, updatedAt: new Date() },
      { upsert: true }
    );

    return NextResponse.json({ success: true, message: '密码重置成功' });
  } catch (error) {
    console.error('重置密码错误:', error);
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 });
  }
}