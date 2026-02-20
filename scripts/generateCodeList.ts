import fs from 'fs';
import path from 'path';
import { AShareNameMap } from '../src/constants/shareNames'; // 根据实际路径调整

const codes = Object.keys(AShareNameMap)
  .filter(key => /^\d{6}\.(SS|SZ)$/.test(key))
  .map(key => ({
    code: key.split('.')[0],
    exchange: key.split('.')[1].toLowerCase()
  }));

const output = codes.map(item => `${item.code},${item.exchange}`).join('\n');
const outputPath = path.join(__dirname, 'stock_codes.txt');
fs.writeFileSync(outputPath, output);
console.log(`✅ 已生成 ${codes.length} 个股票代码到 ${outputPath}`);