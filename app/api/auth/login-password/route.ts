// /app/api/auth/login-password/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const [{ default: bcrypt }, { default: connectDB }, { default: User }, { setCurrentUserId }] = await Promise.all([
      import('bcryptjs'),
      import('@/lib/mongoose'),
      import('@/models/User'),
      import('@/src/utils/assetStorage'),
    ]);

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

    setCurrentUserId(phone); // 不等待

    return NextResponse.json({
      success: true,
      user: {
        phone,
        name: `用户${phone.slice(-4)}`, // 如果你有 name 字段，也可以从 user.name 获取
        avatarUrl: user.avatarUrl || '', // 返回头像 URL
      },
    });
  } catch (error) {
    console.error('密码登录错误:', error);
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 });
  }
}