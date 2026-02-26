// app/api/user/assets/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.POSTGRES_URL!);

export async function GET(request: NextRequest) {
  // 从请求中获取用户ID（可以从 cookie 或 Authorization header 获取，这里假设通过查询参数传递，但更安全的方式是用 session）
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: '缺少用户ID' }, { status: 400 });
  }

  try {
    const result = await sql`
      SELECT assets FROM user_assets WHERE user_id = ${userId}
    `;
    if (result.length === 0) {
      // 新用户，返回空数组
      return NextResponse.json({ assets: [] });
    }
    return NextResponse.json({ assets: result[0].assets });
  } catch (error) {
    console.error('获取资产失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, assets } = await request.json();
    if (!userId || !Array.isArray(assets)) {
      return NextResponse.json({ error: '参数错误' }, { status: 400 });
    }

    await sql`
      INSERT INTO user_assets (user_id, assets, updated_at)
      VALUES (${userId}, ${JSON.stringify(assets)}::jsonb, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id) DO UPDATE SET
        assets = EXCLUDED.assets,
        updated_at = EXCLUDED.updated_at
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('保存资产失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}