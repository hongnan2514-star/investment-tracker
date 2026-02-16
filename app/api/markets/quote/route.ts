import { error } from "console";
import { NextRequest, NextResponse } from "next/server";

const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_KEY;

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');

    if (!symbol || !ALPHA_VANTAGE_KEY) {
        return NextResponse.json(
            { error: 'Missing parameters' },
            { status: 400 }
        );
    }

    try {
        const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`;

        const response = await fetch(quoteUrl, {
            next: { revalidate: 30 } // 更短的缓存时间
        });

        const data = await response.json();

        if (data['Global Quote']) {
            const quote = data['Global Quote'];
            return NextResponse.json({
                success: true,
                data: {
                    symbol: quote['01. symbol'],
                    price: quote['05. price'],
                    change: quote['09. change'],
                    changePercent: quote['10. change percent'],
                    volume: quote['06. volume'],
                    timestamp: new Date().toISOString()
                }
            });
        } else if (data['Note']){
            // API 调用频率限制
            return NextResponse.json({
                error: 'API rate limit reached. Please try again later.',
                code: 'RATE_LIMIT'
            }, { status: 429 });
        } else {
            return NextResponse.json(
                { error: 'Failed to fetch quote' },
                { status: 404 }
            );
        }
    } catch (error) {
        console.error('Quote fetch error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch quote data'},
            { status: 500 }
        );
    }
}