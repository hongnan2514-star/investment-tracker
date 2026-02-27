// app/api/user/profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongoose';
import User from '@/models/User';

export async function POST(request: NextRequest) {
  try {
    const { phone, name, avatarUrl, preferredCurrency } = await request.json();
    if (!phone) {
      return NextResponse.json({ error: '缺少手机号' }, { status: 400 });
    }

    await connectDB();

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
    if (preferredCurrency !== undefined) updateData.preferredCurrency = preferredCurrency;
    updateData.updatedAt = new Date();

    const user = await User.findOneAndUpdate(
      { phone },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      user: {
        phone: user.phone,
        name: user.name,
        avatarUrl: user.avatarUrl,
        preferredCurrency: user.preferredCurrency,
      },
    });
  } catch (error) {
    console.error('更新用户信息失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}