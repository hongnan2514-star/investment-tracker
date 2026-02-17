// /app/api/auth/reset-password/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const [{ default: bcrypt }, { default: connectDB }, { default: User }, { default: Otp }] = await Promise.all([
      import('bcryptjs'),
      import('@/lib/mongoose'),
      import('@/models/User'),
      import('@/models/Otp'),
    ]);

    const { phone, otp, newPassword } = await req.json();

    if (!phone || !otp || !newPassword) {
      return NextResponse.json({ success: false, message: '参数缺失' }, { status: 400 });
    }

    await connectDB();

    const record = await Otp.findOne({ phoneNumber: phone }).sort({ createdAt: -1 });
    if (!record || record.otp !== otp) {
      return NextResponse.json({ success: false, message: '验证码错误' }, { status: 400 });
    }
    await Otp.deleteOne({ _id: record._id });

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