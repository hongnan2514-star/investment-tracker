// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const [{ default: bcrypt }, { default: connectDB }, { default: User }] = await Promise.all([
      import('bcryptjs'),
      import('@/lib/mongoose'),
      import('@/models/User'),
    ]);

    const { phoneNumber, password } = await req.json();

    if (!phoneNumber || !password || password.length < 6) {
      return NextResponse.json({ success: false, message: '手机号和密码（至少6位）不能为空' }, { status: 400 });
    }

    await connectDB();

    // 检查用户是否已存在
    const existingUser = await User.findOne({ phone: phoneNumber });
    if (existingUser) {
      return NextResponse.json({ success: false, message: '该手机号已注册' }, { status: 400 });
    }

    // 加密密码
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 创建用户
    const newUser = await User.create({
      phone: phoneNumber,
      passwordHash,
      name: `用户${phoneNumber.slice(-4)}`,
      avatarUrl: '',
      preferredCurrency: 'USD',
    });

    const userInfo = {
      phone: newUser.phone,
      name: newUser.name,
      avatarUrl: newUser.avatarUrl,
      preferredCurrency: newUser.preferredCurrency,
    };

    return NextResponse.json({ success: true, user: userInfo });
  } catch (error) {
    console.error('注册错误:', error);
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 });
  }
}