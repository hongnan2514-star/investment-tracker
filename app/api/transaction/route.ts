// app/api/transaction/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.POSTGRES_URL!);

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const body = await request.json();
  const { assetSymbol, transactionType, quantity, price, transactionDate, currency, category, note } = body;

  if (!assetSymbol || !transactionType || !quantity || !price || !transactionDate || !currency) {
    return NextResponse.json({ error: '缺少必要字段' }, { status: 400 });
  }

  if (!['buy', 'sell'].includes(transactionType)) {
    return NextResponse.json({ error: '交易类型错误' }, { status: 400 });
  }

  try {
    await sql`
    INSERT INTO transactions (user_id, asset_symbol, transaction_type, quantity, price, transaction_date, currency, category, note)
    VALUES (${userId}, ${assetSymbol}, ${transactionType}, ${quantity}, ${price}, ${transactionDate}, ${currency}, ${category || null}, ${note || null})
    `;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('添加交易记录失败:', error);
    return NextResponse.json({ error: '数据库错误' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const assetSymbol = request.nextUrl.searchParams.get('assetSymbol');
  if (!assetSymbol) return NextResponse.json({ error: '缺少资产代码' }, { status: 400 });

  const type = request.nextUrl.searchParams.get('type');

  let query;
  if (type === 'buy' || type === 'sell') {
    query = sql`
      SELECT * FROM transactions
      WHERE user_id = ${userId} AND asset_symbol = ${assetSymbol} AND transaction_type = ${type}
      ORDER BY transaction_date DESC
    `;
  } else {
    query = sql`
      SELECT * FROM transactions
      WHERE user_id = ${userId} AND asset_symbol = ${assetSymbol}
      ORDER BY transaction_date DESC
    `;
  }
  const result = await query;
  return NextResponse.json(result);
}

export async function DELETE(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const body = await request.json();
  const { ids } = body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: '缺少要删除的ID列表' }, { status: 400 });
  }

  try {
    // 1. 获取这些交易记录的详细信息（金额、交易类型、关联资产符号）
    const transactions = await sql`
      SELECT id, asset_symbol, transaction_type, price
      FROM transactions
      WHERE user_id = ${userId} AND id = ANY(${ids})
    `;

    if (transactions.length === 0) {
      return NextResponse.json({ error: '未找到交易记录' }, { status: 404 });
    }

    // 2. 按资产符号分组，计算每个账户需要调整的余额变化
    const balanceChanges: Record<string, number> = {};
    for (const tx of transactions) {
      const { asset_symbol, transaction_type, price } = tx;
      // 收入（buy）删除后应减少余额，支出（sell）删除后应增加余额
      const delta = transaction_type === 'buy' ? -price : price;
      balanceChanges[asset_symbol] = (balanceChanges[asset_symbol] || 0) + delta;
    }

    // 3. 更新每个账户的余额（使用事务确保一致性）
    for (const [symbol, delta] of Object.entries(balanceChanges)) {
      await sql`
        UPDATE assets
        SET market_value = market_value + ${delta},
            last_updated = NOW()
        WHERE user_id = ${userId} AND symbol = ${symbol}
      `;
    }

    // 4. 删除交易记录
    await sql`DELETE FROM transactions WHERE user_id = ${userId} AND id = ANY(${ids})`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除交易记录失败:', error);
    return NextResponse.json({ error: '数据库错误' }, { status: 500 });
  }
}