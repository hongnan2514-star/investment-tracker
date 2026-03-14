// app/api/metal/latest/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getLatestMetalPrice, saveMetalPrice, needsMetalDailyUpdate } from '@/src/services/fundHistoryDB';
import { queryJuheGold } from '../../data-sources/juhe-gold';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (!code) {
    return NextResponse.json({ error: '缺少贵金属代码' }, { status: 400 });
  }

  try {
    // 1. 检查是否需要更新（当天是否已有数据）
    const needsUpdate = await needsMetalDailyUpdate(code);

    let priceData: { price: number; changePercent: number; name: string; currency: string; market: string; metadata?: any } | null = null;

    if (needsUpdate) {
      // 2. 需要更新，调用聚合数据接口获取最新行情
      console.log(`[贵金属API] ${code} 需要更新，尝试从聚合数据获取`);
      const result = await queryJuheGold(code);
      if (!result.success || !result.data) {
        console.error(`[贵金属API] 聚合数据获取失败: ${result.error}`);
        return NextResponse.json({ error: result.error || '获取贵金属数据失败' }, { status: 500 });
      }

      // 3. 构造数据库记录（处理可能的 null/undefined）
      const today = new Date().toISOString().split('T')[0];
      const record = {
        symbol: code,
        date: today,
        price: result.data.price ?? 0,
        changePercent: result.data.changePercent ?? 0,
        open: result.data.metadata?.open ?? null,
        high: result.data.metadata?.high ?? null,
        low: result.data.metadata?.low ?? null,
        prevClose: result.data.metadata?.prevClose ?? null,
        volume: result.data.metadata?.volume ?? null,
      };

      // 4. 保存到数据库
      await saveMetalPrice(record);
      console.log(`[贵金属API] ${code} 最新价格已保存`);

      priceData = {
        price: record.price,
        changePercent: record.changePercent,
        name: result.data.name || code,               // 如果名称为空，用代码代替
        currency: result.data.currency || 'CNY',       // 默认人民币
        market: result.data.market || '上海黄金交易所', // 默认市场
        metadata: result.data.metadata,
      };
    } else {
      // 5. 已有当天数据，直接从数据库读取
      console.log(`[贵金属API] ${code} 数据已最新，从数据库读取`);
      const latest = await getLatestMetalPrice(code);
      if (!latest) {
        return NextResponse.json({ error: '数据库中无该贵金属数据' }, { status: 404 });
      }
      priceData = {
        price: latest.price,
        changePercent: latest.changePercent,
        name: code,               // 数据库中没有名称，暂时用代码
        currency: 'CNY',
        market: '上海黄金交易所',
      };
    }

    // 6. 返回统一格式（与搜索接口兼容）
    return NextResponse.json({
      success: true,
      symbol: code,
      name: priceData.name,
      price: priceData.price,
      changePercent: priceData.changePercent,
      currency: priceData.currency,
      market: priceData.market,
      type: 'metal',
      source: needsUpdate ? 'JuheGold' : 'database',
      metadata: priceData.metadata,
    });

  } catch (error: any) {
    console.error('[贵金属API] 错误:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}