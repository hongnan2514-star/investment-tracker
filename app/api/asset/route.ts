// app/api/asset/route.ts
import { NextResponse } from 'next/server';
import { query } from '@/src/lib/db';
import { getCurrentUserId } from '@/src/utils/assetStorage';

export async function GET() {
  const userId = getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  const result = await query(
    'SELECT id, symbol, name, price, holdings, market_value as "marketValue", currency, type, last_updated as "lastUpdated", change_percent as "changePercent", logo_url as "logoUrl", purchase_date as "purchaseDate", cost_price as "costPrice", notes, include_in_chart as "includeInChart" FROM assets WHERE user_id = $1',
    [userId]
  );
  return NextResponse.json(result.rows);
}

export async function POST(request: Request) {
  const userId = getCurrentUserId();
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const body = await request.json();
  const { symbol, name, price, holdings, marketValue, currency, type, logoUrl, purchaseDate, costPrice, notes, includeInChart } = body;
  await query(
    `INSERT INTO assets (user_id, symbol, name, price, holdings, market_value, currency, type, logo_url, purchase_date, cost_price, notes, include_in_chart)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [userId, symbol, name, price, holdings, marketValue, currency, type, logoUrl, purchaseDate, costPrice, notes, includeInChart]
  );
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const userId = getCurrentUserId();
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { symbol } = await request.json();
  await query('DELETE FROM assets WHERE user_id = $1 AND symbol = $2', [userId, symbol]);
  return NextResponse.json({ success: true });
}