// app/api/auth/change-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/neon';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
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

    // 查询用户是否存在及当前密码哈希
    const userResult = await query(
      `SELECT phone, password_hash FROM users WHERE phone = $1`,
      [phone]
    );

    if (userResult.rowCount === 0) {
      return NextResponse.json(
        { success: false, message: '用户不存在' },
        { status: 404 }
      );
    }

    const user = userResult.rows[0];

    // 检查用户是否已设置密码
    if (!user.password_hash) {
      return NextResponse.json(
        { success: false, message: '该账号未设置密码，请使用忘记密码功能设置' },
        { status: 400 }
      );
    }

    // 验证旧密码
    const isValid = await bcrypt.compare(oldPassword, user.password_hash);
    if (!isValid) {
      return NextResponse.json(
        { success: false, message: '当前密码错误' },
        { status: 401 }
      );
    }

    // 哈希新密码
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // 更新密码和更新时间
    await query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE phone = $2`,
      [newPasswordHash, phone]
    );

    return NextResponse.json({ success: true, message: '密码修改成功' });
  } catch (error) {
    console.error('修改密码错误:', error);
    return NextResponse.json(
      { success: false, message: '服务器错误' },
      { status: 500 }
    );
  }
}