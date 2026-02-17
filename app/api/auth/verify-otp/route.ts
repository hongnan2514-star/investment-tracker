import { NextRequest, NextResponse } from 'next/server';
import Otp from '@/models/Otp';
import connectDB from '@/lib/mongoose';

export const dynamic = 'force-dynamic'; // 强制动态路由，确保每次请求都执行服务器端逻辑

export async function POST(req: NextRequest) {
  try {
    const { phoneNumber, otp } = await req.json();
    await connectDB();

    // 1. 查找该手机号最新的、未过期的验证码
    const record = await Otp.findOne({ phoneNumber }).sort({ createdAt: -1 });

    if (!record) {
      return NextResponse.json({ success: false, message: '验证码已失效，请重新获取' });
    }

    // 2. 比对验证码（生产环境应使用 bcrypt 对比哈希值）
    if (record.otp === otp) {
      // 验证成功，删除该验证码记录
      await Otp.deleteOne({ _id: record._id });
      
      // TODO: 在这里查找或创建用户，生成 session 或 JWT
      // 例如：const user = await findOrCreateUser(phoneNumber);

      return NextResponse.json({ 
        success: true, 
        message: '登录成功',
        // user: user // 返回用户信息
      });
    } else {
      return NextResponse.json({ success: false, message: '验证码错误' });
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 });
  }
}