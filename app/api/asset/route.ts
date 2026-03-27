// app/api/asset/route.ts
import { NextResponse } from 'next/server';
import { query } from '@/src/lib/db';

export async function GET(request: Request) {
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  try {
    const result = await query(
      `SELECT id, symbol, name, price, holdings, market_value as "marketValue",
              currency, type, last_updated as "lastUpdated",
              change_percent as "changePercent",
              purchase_date as "purchaseDate", cost_price as "costPrice",
              notes, include_in_chart as "includeInChart",
              logo_url as "logoUrl"
       FROM assets WHERE user_id = $1`,
      [userId]
    );
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('加载资产失败', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });
  try {
    const body = await request.json();
    const { symbol, name, price, holdings, marketValue, currency, type,
            purchaseDate, costPrice, notes, includeInChart, logoUrl } = body;
    await query(
      `INSERT INTO assets
       (user_id, symbol, name, price, holdings, market_value, currency, type,
        purchase_date, cost_price, notes, include_in_chart, logo_url, last_updated)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())`,
      [userId, symbol, name, price, holdings, marketValue, currency, type,
       purchaseDate, costPrice, notes, includeInChart, logoUrl]
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('添加资产失败', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });
  try {
    const { symbol } = await request.json();
    await query('DELETE FROM assets WHERE user_id = $1 AND symbol = $2', [userId, symbol]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除资产失败', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}