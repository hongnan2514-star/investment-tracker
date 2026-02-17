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

    const { phoneNumber, otp } = await req.json();
    await connectDB();

    const record = await Otp.findOne({ phoneNumber }).sort({ createdAt: -1 });

    if (!record) {
      return NextResponse.json({ success: false, message: '验证码已失效，请重新获取' });
    }

    if (record.otp === otp) {
      await Otp.deleteOne({ _id: record._id });
      return NextResponse.json({ success: true, message: '登录成功' });
    } else {
      return NextResponse.json({ success: false, message: '验证码错误' });
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 });
  }
}