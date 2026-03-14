import fs from 'fs';
import path from 'path';

const logosDir = path.join(process.cwd(), 'public', 'images', 'car_logos');
const outputFile = path.join(process.cwd(), 'public', 'car_logo_filenames.json');

const files = fs.readdirSync(logosDir)
  .filter(f => /\.(png|jpg|jpeg|svg)$/i.test(f))
  .map(f => f.replace(/\.[^/.]+$/, ''))
  .sort();

fs.writeFileSync(outputFile, JSON.stringify(files, null, 2));
console.log(`✅ 已生成文件名列表，共 ${files.length} 个文件，保存至 ${outputFile}`);