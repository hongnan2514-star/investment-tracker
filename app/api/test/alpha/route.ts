import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_KEY;
  
  if (!ALPHA_VANTAGE_KEY) {
    return NextResponse.json(
      { error: 'API key not configured' },
      { status: 500 }
    );
  }

  // 测试查询TSLA
  const testUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=TSLA&apikey=${ALPHA_VANTAGE_KEY}`;
  
  try {
    const response = await fetch(testUrl);
    const data = await response.json();
    
    return NextResponse.json({
      apiKeyConfigured: true,
      alphaVantageResponse: data,
      note: data['Note'] || 'API调用成功'
    });
  } catch (error) {
    return NextResponse.json({
      apiKeyConfigured: true,
      error: (error as Error).message
    }, { status: 500 });
  }
}