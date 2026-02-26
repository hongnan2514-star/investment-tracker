// app/api/user/avatar/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { neon } from '@neondatabase/serverless';
import connectDB from '@/lib/mongoose';
import User from '@/models/User';

// 如果使用 MongoDB
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('avatar') as File;
    const userId = formData.get('userId') as string; // 用户手机号

    if (!file || !userId) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }

    // 上传到 Vercel Blob
    const blob = await put(`avatars/${userId}-${Date.now()}`, file, {
      access: 'public',
    });

    // 更新 MongoDB 中的用户头像
    await connectDB();
    await User.findOneAndUpdate(
      { phone: userId },
      { avatarUrl: blob.url },
      { new: true }
    );

    return NextResponse.json({ avatarUrl: blob.url });
  } catch (error) {
    console.error('头像上传失败:', error);
    return NextResponse.json({ error: '上传失败' }, { status: 500 });
  }
}