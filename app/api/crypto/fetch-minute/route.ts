import { NextRequest, NextResponse } from 'next/server';
import { fetchCryptoMinuteData } from '../../data-sources/crypto-ccxt';
import { saveCryptoMinute } from '@/src/services/fundHistoryDB';

export async function POST(request: NextRequest) {
  try {
    const { symbol, resolution, limit } = await request.json();

    if (!symbol || !resolution) {
      return NextResponse.json(
        { error: '缺少 symbol 或 resolution' },
        { status: 400 }
      );
    }

    // 从 CCXT 获取分钟数据（自动尝试多个交易所）
    const data = await fetchCryptoMinuteData(symbol, resolution, limit || 100);

    if (!data || data.length === 0) {
      return NextResponse.json(
        { success: false, message: '未获取到数据' },
        { status: 404 }
      );
    }

    // 转换为数据库格式
    const records = data.map(item => ({
      symbol: `${symbol}/USDT`,  // 注意保持与前端格式一致
      timestamp: item.timestamp,
      resolution,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volume,
    }));

    // 保存到 Neon
    await saveCryptoMinute(records);

    return NextResponse.json({
      success: true,
      count: records.length,
      message: `已保存 ${records.length} 条 ${resolution} 数据`,
    });
  } catch (error: any) {
    console.error('获取分钟数据失败:', error);
    return NextResponse.json(
      { error: error.message || '服务器内部错误' },
      { status: 500 }
    );
  }
}

// 可选：GET 方法用于测试连接
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol');
  const resolution = searchParams.get('resolution');

  if (!symbol || !resolution) {
    return NextResponse.json(
      { error: '缺少 symbol 或 resolution' },
      { status: 400 }
    );
  }

  try {
    const data = await fetchCryptoMinuteData(symbol, resolution, 1);
    return NextResponse.json({
      success: true,
      message: '连接成功',
      latest: data?.[0] || null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}