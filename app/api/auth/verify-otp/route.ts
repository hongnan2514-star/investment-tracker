// /app/api/auth/verify-otp/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon'; // 新增：Neon 查询方法

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // 只导入 connectDB 和 Otp（因为验证码仍在 MongoDB）
    const [{ default: connectDB }, { default: Otp }] = await Promise.all([
      import('@/lib/mongoose'),
      import('@/models/Otp'),
    ]);

    const { phoneNumber, otp } = await req.json();

    if (!phoneNumber || !otp) {
      return NextResponse.json(
        { success: false, message: '参数错误' },
        { status: 400 }
      );
    }

    await connectDB();

    // 查找最新的验证码（仍在 MongoDB）
    const record = await Otp.findOne({ phoneNumber }).sort({ createdAt: -1 });

    if (!record) {
      return NextResponse.json({
        success: false,
        message: '验证码已失效，请重新获取',
      });
    }

    if (record.otp !== otp) {
      return NextResponse.json({ success: false, message: '验证码错误' });
    }

    // 验证成功，删除验证码
    await Otp.deleteOne({ _id: record._id });

    // 从 Neon 查询用户是否存在
    const userResult = await query(
      `SELECT phone, name, avatar_url AS "avatarUrl", preferred_currency AS "preferredCurrency" 
       FROM users WHERE phone = $1`,
      [phoneNumber]
    );

    if (userResult.rowCount && userResult.rowCount > 0) {
      const user = userResult.rows[0];
      // 如果 name 为空，提供默认值（与之前逻辑一致）
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
    return NextResponse.json(
      { success: false, message: '服务器错误' },
      { status: 500 }
    );
  }
}