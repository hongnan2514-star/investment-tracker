// app/api/user/profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';

export async function POST(request: NextRequest) {
  try {
    const { phone, name, avatarUrl, preferredCurrency } = await request.json();
    if (!phone) {
      return NextResponse.json({ error: '缺少手机号' }, { status: 400 });
    }

    // 动态构建更新语句
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (avatarUrl !== undefined) {
      updates.push(`avatar_url = $${paramIndex++}`);
      values.push(avatarUrl);
    }
    if (preferredCurrency !== undefined) {
      updates.push(`preferred_currency = $${paramIndex++}`);
      values.push(preferredCurrency);
    }
    
    // 总是更新 updated_at
    updates.push(`updated_at = NOW()`);

    if (updates.length === 0) {
      return NextResponse.json({ error: '没有要更新的字段' }, { status: 400 });
    }

    // 添加 phone 作为 WHERE 条件的参数
    values.push(phone);

    const updateQuery = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE phone = $${paramIndex}
      RETURNING phone, name, avatar_url AS "avatarUrl", preferred_currency AS "preferredCurrency"
    `;

    const result = await query(updateQuery, values);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    const updatedUser = result.rows[0];

    return NextResponse.json({
      success: true,
      user: {
        phone: updatedUser.phone,
        name: updatedUser.name,
        avatarUrl: updatedUser.avatarUrl,
        preferredCurrency: updatedUser.preferredCurrency,
      },
    });
  } catch (error) {
    console.error('更新用户信息失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}