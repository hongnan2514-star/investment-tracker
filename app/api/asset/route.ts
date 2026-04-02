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
    if (!symbol) {
      return NextResponse.json({ error: '缺少资产代码' }, { status: 400 });
    }

    // 开启事务：先删除交易记录，再删除资产
    await query('BEGIN');

    // 1. 删除 transactions 表中该资产的所有记录
    const deleteTransactionsResult = await query(
      'DELETE FROM transactions WHERE user_id = $1 AND asset_symbol = $2',
      [userId, symbol]
    );

    // 2. 删除 assets 表中的资产
    const deleteAssetResult = await query(
      'DELETE FROM assets WHERE user_id = $1 AND symbol = $2',
      [userId, symbol]
    );

    if (deleteAssetResult.rowCount === 0) {
      // 资产不存在，回滚事务
      await query('ROLLBACK');
      return NextResponse.json({ error: '资产不存在或无权限' }, { status: 404 });
    }

    // 提交事务
    await query('COMMIT');

    return NextResponse.json({ 
      success: true,
      deletedTransactions: deleteTransactionsResult.rowCount || 0
    });
  } catch (error) {
    // 发生错误时回滚
    await query('ROLLBACK').catch(console.error);
    console.error('删除资产及交易记录失败:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { symbol, holdings, costPrice, marketValue } = body;

    if (!symbol || holdings === undefined) {
      return NextResponse.json({ error: '缺少必要字段 (symbol, holdings)' }, { status: 400 });
    }

    // 构建动态更新语句
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    updates.push(`holdings = $${paramIndex++}`);
    params.push(holdings);

    if (costPrice !== undefined) {
      updates.push(`cost_price = $${paramIndex++}`);
      params.push(costPrice);
    }

    if (marketValue !== undefined) {
      updates.push(`market_value = $${paramIndex++}`);
      params.push(marketValue);
    }

    updates.push(`last_updated = NOW()`);
    params.push(symbol, userId);

    const sql = `
      UPDATE assets
      SET ${updates.join(', ')}
      WHERE symbol = $${paramIndex} AND user_id = $${paramIndex + 1}
      RETURNING *
    `;

    const result = await query(sql, params);
    if (result.rowCount === 0) {
      return NextResponse.json({ error: '资产不存在或无权限' }, { status: 404 });
    }

    return NextResponse.json({ success: true, asset: result.rows[0] });
  } catch (error) {
    console.error('更新资产失败:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}