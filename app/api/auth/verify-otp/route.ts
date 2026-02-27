// /app/api/auth/verify-otp/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const [{ default: connectDB }, { default: Otp }, { default: User }] = await Promise.all([
      import('@/lib/mongoose'),
      import('@/models/Otp'),
      import('@/models/User'),
    ]);

    const { phoneNumber, otp } = await req.json();

    if (!phoneNumber || !otp) {
      return NextResponse.json({ success: false, message: '参数错误' }, { status: 400 });
    }

    await connectDB();

    // 查找最新的验证码
    const record = await Otp.findOne({ phoneNumber }).sort({ createdAt: -1 });

    if (!record) {
      return NextResponse.json({ success: false, message: '验证码已失效，请重新获取' });
    }

    if (record.otp !== otp) {
      return NextResponse.json({ success: false, message: '验证码错误' });
    }

    // 验证成功，删除验证码
    await Otp.deleteOne({ _id: record._id });

    // 查找或创建用户
    let user = await User.findOne({ phone: phoneNumber });
    if (!user) {
      // 创建新用户，使用默认值
      const defaultName = `用户${phoneNumber.slice(-4)}`;
      user = await User.create({
        phone: phoneNumber,
        name: defaultName,
        avatarUrl: '',
        preferredCurrency: 'USD',
      });
    }

    // 返回用户信息（排除敏感字段如 passwordHash）
    const userInfo = {
      phone: user.phone,
      name: user.name,
      avatarUrl: user.avatarUrl,
      preferredCurrency: user.preferredCurrency,
    };

    return NextResponse.json({ success: true, user: userInfo });
  } catch (error) {
    console.error('验证码登录错误:', error);
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 });
  }
}