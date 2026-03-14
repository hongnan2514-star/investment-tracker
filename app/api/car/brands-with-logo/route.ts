// app/api/brands-with-logo
import { NextRequest, NextResponse } from 'next/server';

const JUHE_CAR_KEY = process.env.JUHE_CAR_KEY;
const JUHE_CAR_URL = 'http://apis.juhe.cn/cxdq/brand'; // 聚合数据品牌接口

// 内存缓存（避免每次请求都调用聚合数据）
let brandCache: { data: any[]; timestamp: number } | null = null;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24小时缓存

export async function GET(request: NextRequest) {
  try {
    // 1. 检查缓存
    if (brandCache && Date.now() - brandCache.timestamp < CACHE_DURATION) {
      return NextResponse.json({ 
        success: true, 
        data: brandCache.data,
        source: 'cache'
      });
    }

    // 2. 检查 API Key
    if (!JUHE_CAR_KEY) {
      console.error('JUHE_CAR_KEY 未配置');
      return NextResponse.json({ 
        success: false, 
        error: '车辆品牌 API 未配置' 
      }, { status: 500 });
    }

    // 3. 从聚合数据获取品牌列表
    // 注意：聚合数据接口需要 first_letter 参数，但我们可以遍历所有字母
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('');
    let allBrands: any[] = [];

    for (const letter of letters) {
      const url = `${JUHE_CAR_URL}?key=${JUHE_CAR_KEY}&first_letter=${letter}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.error_code === 0 && data.result) {
        // 聚合数据返回的 result 可能是数组，也可能是对象，需要根据实际情况处理
        const brands = Array.isArray(data.result) ? data.result : [data.result];
        allBrands = allBrands.concat(brands);
      }

      // 避免请求过快
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // 4. 处理数据，转换为统一格式
    const formattedBrands = allBrands.map((brand: any) => ({
      id: brand.id || brand.brand_id || String(brand.name),
      name: brand.brand_name || brand.name,
      firstLetter: brand.first_letter || brand.name.charAt(0).toUpperCase(),
      logoUrl: brand.brand_logo, // 聚合数据返回的 Logo URL
    }));

    // 5. 更新缓存
    brandCache = {
      data: formattedBrands,
      timestamp: Date.now(),
    };

    return NextResponse.json({ 
      success: true, 
      data: formattedBrands,
      source: 'juhe'
    });

  } catch (error: any) {
    console.error('获取汽车品牌失败:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || '获取汽车品牌失败' 
    }, { status: 500 });
  }
}