import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { config } from 'dotenv';

config({ path: path.resolve(process.cwd(), '.env.local') });

const JUHE_CAR_KEY = process.env.JUHE_CAR_KEY;
if (!JUHE_CAR_KEY) throw new Error('请在 .env.local 中设置 JUHE_CAR_KEY');

const OUTPUT_FILE = path.join(process.cwd(), 'src', 'constants', 'carBrandsWithId.json');

const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('');
let allBrands: any[] = [];

async function fetchAllBrands() {
  console.log('开始从聚合数据获取品牌列表...');
  for (const letter of letters) {
    const url = `http://apis.juhe.cn/cxdq/brand?key=${JUHE_CAR_KEY}&first_letter=${letter}`;
    try {
      const res = await axios.get(url);
      if (res.data.error_code === 0 && res.data.result) {
        const brands = Array.isArray(res.data.result) ? res.data.result : [res.data.result];
        // 提取需要的字段：品牌名称、ID（可能是 brand_id 或类似）
        brands.forEach((b: any) => {
          const name = b.brand_name || b.name;
          const id = b.brand_id || b.id || (name ? name.toLowerCase().replace(/\s+/g, '-') : '');
          if (name && id) {
            allBrands.push({ name, id });
          }
        });
      }
    } catch (err) {
      console.error(`获取字母 ${letter} 失败:`, err);
    }
    await new Promise(r => setTimeout(r, 300));
  }

  // 去重（基于name）
  const unique = new Map();
  allBrands.forEach(b => {
    if (!unique.has(b.name)) unique.set(b.name, b);
  });
  const result = Array.from(unique.values());

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
  console.log(`✅ 已生成品牌数据，共 ${result.length} 条，保存至 ${OUTPUT_FILE}`);
}

fetchAllBrands().catch(console.error);