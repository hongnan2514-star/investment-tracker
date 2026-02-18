// app/api/test-env/route.ts
export async function GET() {
  const keys = Object.keys(process.env).sort();
  return Response.json({
    mongoUriExists: !!process.env.MONGODB_URI,
    deepseekKeyExists: !!process.env.DEEPSEEK_API_KEY,
    vercelEnv: process.env.VERCEL_ENV,
    nodeEnv: process.env.NODE_ENV,
    allKeys: keys, // 输出所有环境变量键名
  });
}