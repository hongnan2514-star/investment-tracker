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

    // 查询用户是否存在（不自动创建）
    const user = await User.findOne({ phone: phoneNumber });

    if (user) {
      // 用户已存在，返回用户信息（可用于直接登录，但按需求，我们让前端提示使用密码登录）
      const userInfo = {
        phone: user.phone,
        name: user.name || `用户${phoneNumber.slice(-4)}`,
        avatarUrl: user.avatarUrl || '',
        preferredCurrency: user.preferredCurrency || 'USD',
      };
      return NextResponse.json({ success: true, exists: true, user: userInfo });
    } else {
      // 用户不存在
      return NextResponse.json({ success: true, exists: false });
    }
  } catch (error) {
    console.error('验证码验证错误:', error);
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 });
  }
}