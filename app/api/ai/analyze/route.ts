// app/api/ai/analyze/route.ts

import { NextRequest, NextResponse } from 'next/server';

// 假设你已配置 DEEPSEEK_API_KEY 在 .env.local
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY!;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: '你是一个专业的投资分析助手，用简洁中文总结昨日盈亏原因，不超过100字。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 200,
      }),
    });

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content || '暂时无法生成分析';

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error('AI 分析失败:', error);
    return NextResponse.json({ error: '分析服务暂时不可用' }, { status: 500 });
  }
}