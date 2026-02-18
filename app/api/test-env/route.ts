export async function GET() {
  const keys = Object.keys(process.env).sort();
  return Response.json({
    mongoUriExists: !!process.env.MONGODB_URI,
    deepseekKeyExists: !!process.env.DEEPSEEK_API_KEY,
    allKeys: keys, // 列出所有环境变量名（不含值）
  });
}