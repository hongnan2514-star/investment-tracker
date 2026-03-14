import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { config } from 'dotenv';

config({ path: path.resolve(process.cwd(), '.env.local') });

const OUTPUT_DIR = path.join(process.cwd(), 'public', 'images', 'car_logos');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// 生成 slug 的工具函数（与之前 carBrands.ts 中的一致）
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[·・•\-_\s]+/g, '-')   // 将各种分隔符替换为连字符
    .replace(/[^\w\u4e00-\u9fa5\-]+/g, '') // 移除其他特殊字符，保留中文、字母、数字、连字符
    .replace(/-+/g, '-')               // 合并连续连字符
    .replace(/^-|-$/g, '');             // 去除首尾连字符
}

async function fetchBrandsFromLocal() {
  try {
    const res = await axios.get('http://localhost:3000/api/car/brands-with-logo');
    if (res.data.success && Array.isArray(res.data.data)) {
      return res.data.data;
    }
    throw new Error('返回数据格式错误');
  } catch (err) {
    console.error('无法从本地 API 获取品牌列表，请确认开发服务器是否运行在 3000 端口');
    throw err;
  }
}

async function fetchBrandsFromJuhe() {
  const JUHE_CAR_KEY = process.env.JUHE_CAR_KEY;
  if (!JUHE_CAR_KEY) throw new Error('请在 .env.local 中设置 JUHE_CAR_KEY');

  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('');
  let allBrands: any[] = [];

  for (const letter of letters) {
    const url = `http://apis.juhe.cn/cxdq/brand?key=${JUHE_CAR_KEY}&first_letter=${letter}`;
    const res = await axios.get(url);
    if (res.data.error_code === 0 && res.data.result) {
      const brands = Array.isArray(res.data.result) ? res.data.result : [res.data.result];
      allBrands = allBrands.concat(brands);
    }
    await new Promise(r => setTimeout(r, 200));
  }

  // 转换为统一格式，并确保 id 是字符串（基于品牌名称生成）
  return allBrands.map((brand: any) => {
    const name = brand.brand_name || brand.name || '';
    return {
      id: generateSlug(name), // 使用生成的 slug 作为 id
      name: name,
      firstLetter: brand.first_letter || name.charAt(0).toUpperCase(),
      logoUrl: brand.brand_logo,
    };
  });
}

async function downloadImage(brand: { id: string; name: string; logoUrl: string }, index: number, total: number) {
  const ext = path.extname(brand.logoUrl) || '.png';
  const filename = `${brand.id}${ext}`;
  const filepath = path.join(OUTPUT_DIR, filename);

  console.log(`[${index}/${total}] 下载 ${brand.name} -> ${filename}`);
  try {
    const response = await axios({
      method: 'GET',
      url: brand.logoUrl,
      responseType: 'stream',
      timeout: 15000,
    });
    const writer = fs.createWriteStream(filepath);
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log(`  ✅ 已保存 ${filename}`);
        resolve(true);
      });
      writer.on('error', reject);
    });
  } catch (err: any) {
    console.error(`  ❌ 下载失败: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('开始获取品牌列表...');
  
  let brands: any[];
  try {
    brands = await fetchBrandsFromLocal();
    console.log(`从本地 API 获取到 ${brands.length} 个品牌`);
    // 如果本地 API 返回的品牌没有合适的 id，我们也可以重新生成
    brands = brands.map(b => ({
      ...b,
      id: generateSlug(b.name),
    }));
  } catch (err) {
    console.log('尝试直接调用聚合数据接口...');
    brands = await fetchBrandsFromJuhe();
    console.log(`从聚合数据获取到 ${brands.length} 个品牌`);
  }

  const brandsWithLogo = brands.filter(b => b.logoUrl);
  console.log(`其中有 logoUrl 的品牌: ${brandsWithLogo.length}`);

  const concurrency = 5;
  let successCount = 0;
  for (let i = 0; i < brandsWithLogo.length; i += concurrency) {
    const batch = brandsWithLogo.slice(i, i + concurrency);
    const results = await Promise.all(batch.map((brand, idx) => 
      downloadImage(brand, i + idx + 1, brandsWithLogo.length)
    ));
    successCount += results.filter(Boolean).length;
  }

  console.log(`下载完成！成功 ${successCount} 个，失败 ${brandsWithLogo.length - successCount} 个`);

  // 删除旧的数字命名图片（可选）
  const oldFiles = fs.readdirSync(OUTPUT_DIR).filter(f => /^\d+\.(png|jpg|jpeg|svg)$/i.test(f));
  if (oldFiles.length > 0) {
    console.log(`发现 ${oldFiles.length} 个旧数字命名的图片，建议手动删除。`);
    // 如果想自动删除，取消下一行注释
    // oldFiles.forEach(f => fs.unlinkSync(path.join(OUTPUT_DIR, f)));
  }
}

main().catch(console.error);