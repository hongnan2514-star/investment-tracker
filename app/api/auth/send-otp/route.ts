import { NextRequest, NextResponse } from 'next/server';
import Otp from '@/models/Otp';
import connectDB from '@/lib/mongoose';

export const dynamic = 'force-dynamic'; // 强制动态路由，确保每次请求都执行服务器端逻辑
export const runtime = 'nodejs'; // 明确指定使用 Node.js 运行时

export async function POST(req: NextRequest) {
  try {
    const { phoneNumber } = await req.json();
    console.log('收到手机号:', phoneNumber);

    if (!phoneNumber || phoneNumber.length !== 11) {
      return NextResponse.json({ success: false, message: '手机号格式错误' }, { status: 400 });
    }

    await connectDB();
    console.log('数据库连接成功');

    // 生成6位验证码
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    console.log('生成的验证码:', otpCode); // 方便测试时在终端查看

    // 删除该手机号旧的验证码
    await Otp.deleteMany({ phoneNumber });
    console.log('已删除旧验证码');

    // 存储新验证码
    await Otp.create({ phoneNumber, otp: otpCode });
    console.log('新验证码已存储');

    // 🔴 暂时不调用真实短信服务，直接返回成功
    // 以后需要替换为实际短信 API 调用
    return NextResponse.json({ success: true, message: '验证码发送成功（测试）' });

  } catch (error) {
    console.error('发送验证码时发生错误:', error);
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 });
  }
}