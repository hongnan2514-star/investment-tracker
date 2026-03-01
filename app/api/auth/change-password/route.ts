// app/api/auth/change-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 初始化数据库连接（建议在模块顶层，避免每次请求都创建新连接）
const sql = neon(process.env.DATABASE_URL!);

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

    // 查询用户
    const users = await sql`SELECT * FROM users WHERE phone = ${phone}`;
    if (users.length === 0) {
      return NextResponse.json(
        { success: false, message: '用户不存在' },
        { status: 404 }
      );
    }

    const user = users[0];
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

    // 更新数据库
    await sql`
      UPDATE users 
      SET password_hash = ${newPasswordHash}, updated_at = NOW() 
      WHERE phone = ${phone}
    `;

    return NextResponse.json({ success: true, message: '密码修改成功' });
  } catch (error) {
    console.error('修改密码错误:', error);
    return NextResponse.json(
      { success: false, message: '服务器错误' },
      { status: 500 }
    );
  }
}