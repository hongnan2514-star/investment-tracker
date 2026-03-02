// app/api/auth/change-password/route.ts
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

    const { phone, oldPassword, newPassword } = await req.json();

    // 参数校验
    if (!phone || !oldPassword || !newPassword) {
      return NextResponse.json(
        { success: false, message: '参数缺失' },
        { status: 400 }
      );
    }
    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, message: '新密码至少6位' },
        { status: 400 }
      );
    }

    await connectDB();

    // 查询用户
    const user = await User.findOne({ phone });
    if (!user) {
      return NextResponse.json(
        { success: false, message: '用户不存在' },
        { status: 404 }
      );
    }

    // 检查用户是否已设置密码（理论上存在 passwordHash）
    if (!user.passwordHash) {
      return NextResponse.json(
        { success: false, message: '该账号未设置密码，请使用忘记密码功能设置' },
        { status: 400 }
      );
    }

    // 验证旧密码
    const isValid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { success: false, message: '当前密码错误' },
        { status: 401 }
      );
    }

    // 哈希新密码
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // 更新密码
    user.passwordHash = newPasswordHash;
    user.updatedAt = new Date();
    await user.save();

    return NextResponse.json({ success: true, message: '密码修改成功' });
  } catch (error) {
    console.error('修改密码错误:', error);
    return NextResponse.json(
      { success: false, message: '服务器错误' },
      { status: 500 }
    );
  }
}