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
  const { assetSymbol, transactionType, quantity, price, transactionDate, currency } = body;

  if (!assetSymbol || !transactionType || !quantity || !price || !transactionDate || !currency) {
    return NextResponse.json({ error: '缺少必要字段' }, { status: 400 });
  }

  if (!['buy', 'sell'].includes(transactionType)) {
    return NextResponse.json({ error: '交易类型错误' }, { status: 400 });
  }

  try {
    await sql`
      INSERT INTO transactions (user_id, asset_symbol, transaction_type, quantity, price, transaction_date, currency)
      VALUES (${userId}, ${assetSymbol}, ${transactionType}, ${quantity}, ${price}, ${transactionDate}, ${currency})
    `;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('添加交易记录失败:', error);
    return NextResponse.json({ error: '数据库错误' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const assetSymbol = request.nextUrl.searchParams.get('assetSymbol');
  if (!assetSymbol) {
    return NextResponse.json({ error: '缺少资产代码' }, { status: 400 });
  }

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