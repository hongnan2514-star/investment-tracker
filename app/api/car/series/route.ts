import { NextRequest, NextResponse } from 'next/server';
import { getCarSeries } from '@/app/api/data-sources/juhe-car';

export async function GET(request: NextRequest) {
  const brandId = request.nextUrl.searchParams.get('brandId');
  if (!brandId) {
    return NextResponse.json({ success: false, error: '缺少 brandId 参数' }, { status: 400 });
  }
  try {
    const result = await getCarSeries(brandId);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}