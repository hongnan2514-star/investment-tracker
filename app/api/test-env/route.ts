// app/api/test-env/route.ts
export async function GET() {
  return Response.json({
    mongoUriExists: !!process.env.MONGODB_URI,
    deepseekKeyExists: !!process.env.DEEPSEEK_API_KEY,
    vercelEnv: process.env.VERCEL_ENV,   // 由 Vercel 注入，标识当前环境
    nodeEnv: process.env.NODE_ENV,       // 通常是 'production' 或 'development'
  });
}