import { NextRequest, NextResponse } from 'next/server';
import { getCarModels } from '@/app/api/data-sources/juhe-car';

export async function GET(request: NextRequest) {
  const seriesId = request.nextUrl.searchParams.get('seriesId');
  if (!seriesId) {
    return NextResponse.json(
      { success: false, error: '缺少 seriesId 参数' },
      { status: 400 }
    );
  }
  const result = await getCarModels(seriesId);
  return NextResponse.json(result);
}