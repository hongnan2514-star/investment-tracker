// /app/api/auth/send-otp/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const [{ default: connectDB }, { default: Otp }] = await Promise.all([
      import('@/lib/mongoose'),
      import('@/models/Otp'),
    ]);

    const { phoneNumber } = await req.json();
    console.log('收到手机号:', phoneNumber);

    if (!phoneNumber || phoneNumber.length !== 11) {
      return NextResponse.json({ success: false, message: '手机号格式错误' }, { status: 400 });
    }

    await connectDB();

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    console.log('生成的验证码:', otpCode);

    await Otp.deleteMany({ phoneNumber });
    await Otp.create({ phoneNumber, otp: otpCode });

    return NextResponse.json({ success: true, message: '验证码发送成功（测试）' });
  } catch (error) {
    console.error('发送验证码时发生错误:', error);
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 });
  }
}