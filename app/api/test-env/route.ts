export async function GET() {
  return Response.json({
    mongoUriExists: !!process.env.MONGODB_URI,
    deepseekKeyExists: !!process.env.DEEPSEEK_API_KEY,
  });
}