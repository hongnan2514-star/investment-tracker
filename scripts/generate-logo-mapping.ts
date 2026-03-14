// scripts/generate-logo-mapping.ts
import fs from 'fs';
import path from 'path';
import { carBrands } from '../src/constants/carBrands'; // 从你的品牌数据导入

const logosDir = path.join(process.cwd(), 'public', 'images', 'car_logos');
const mappingFile = path.join(process.cwd(), 'public', 'car_logos_mapping.json');

const files = fs.readdirSync(logosDir)
  .filter(f => /^\d+\.(png|jpg|jpeg|svg)$/i.test(f))
  .sort((a, b) => {
    const numA = parseInt(a.match(/^\d+/)![0], 10);
    const numB = parseInt(b.match(/^\d+/)![0], 10);
    return numA - numB;
  });

const mapping: Record<string, string> = {};
carBrands.forEach((brand, index) => {
  if (files[index]) {
    mapping[brand.id] = files[index];
  }
});

fs.writeFileSync(mappingFile, JSON.stringify(mapping, null, 2));
console.log(`映射文件已生成：${mappingFile}`);