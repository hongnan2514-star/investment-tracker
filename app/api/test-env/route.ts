// app/api/test-env/route.ts
export async function GET() {
  return Response.json({
    mongoUriExists: !!process.env.MONGODB_URI,
    deepseekKeyExists: !!process.env.DEEPSEEK_API_KEY,
    vercelEnv: process.env.VERCEL_ENV, // 由 Vercel 自动注入，值为 'production'、'preview' 或 'development'
    nodeEnv: process.env.NODE_ENV,
  });
}