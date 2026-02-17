// /app/api/auth/set-password/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const [{ default: bcrypt }, { default: connectDB }, { default: User }, { getCurrentUserId }] = await Promise.all([
      import('bcryptjs'),
      import('@/lib/mongoose'),
      import('@/models/User'),
      import('@/src/utils/assetStorage'),
    ]);

    const { password } = await req.json();
    const phone = getCurrentUserId();

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
      { upsert: true }
    );

    return NextResponse.json({ success: true, message: '密码设置成功' });
  } catch (error) {
    console.error('设置密码错误:', error);
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 });
  }
}