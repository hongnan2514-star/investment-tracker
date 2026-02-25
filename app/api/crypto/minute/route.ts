// app/api/crypto/minute/route.ts
import { NextRequest } from 'next/server';
import { saveCryptoMinute, getCryptoMinuteHistory } from '@/src/services/fundHistoryDB';

// GET：获取分钟级数据
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol');
  const resolution = searchParams.get('resolution');
  const limit = parseInt(searchParams.get('limit') || '288');

  if (!symbol || !resolution) {
    return Response.json({ error: '缺少参数 symbol 或 resolution' }, { status: 400 });
  }

  try {
    const data = await getCryptoMinuteHistory(symbol, resolution, limit);
    return Response.json(data);
  } catch (error) {
    console.error('获取分钟数据失败:', error);
    return Response.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

// POST：保存分钟级数据
export async function POST(request: NextRequest) {
  try {
    const records = await request.json();
    if (!Array.isArray(records) || records.length === 0) {
      return Response.json({ error: '请求体应为非空数组' }, { status: 400 });
    }

    await saveCryptoMinute(records); // ✅ 直接调用 Neon 异步函数
    return Response.json({ success: true, count: records.length });
  } catch (error) {
    console.error('保存分钟数据失败:', error);
    return Response.json({ error: '服务器内部错误' }, { status: 500 });
  }
}