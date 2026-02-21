import { NextResponse } from 'next/server';
import { getCarBrands } from '@/app/api/data-sources/juhe-car';

export async function GET() {
  try {
    const result = await getCarBrands();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}