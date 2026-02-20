const fs = require('fs');
const path = require('path');
const https = require('https');

// 配置
const CODE_LIST_FILE = path.join(__dirname, 'stock_codes.txt');
const OUTPUT_DIR = path.join(__dirname, '../public/logos');
const DELAY_MS = 200;      // 每次请求间隔 200ms
const TIMEOUT_MS = 5000;    // 超时 5 秒

// 创建输出目录
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
['sh', 'sz'].forEach(sub => {
  const subDir = path.join(OUTPUT_DIR, sub);
  if (!fs.existsSync(subDir)) fs.mkdirSync(subDir);
});

// 读取代码列表
const lines = fs.readFileSync(CODE_LIST_FILE, 'utf-8').split('\n').filter(l => l.trim());
const tasks = lines.map(line => {
  const [code, exchange] = line.split(',');
  return { code, exchange: exchange?.toLowerCase() || (code.startsWith('6') ? 'sh' : 'sz') };
});

console.log(`📦 共找到 ${tasks.length} 个任务`);

// 下载单个 Logo
async function downloadLogo({ code, exchange }) {
  const url = `https://j4.dfcfw.com/charts/pic2/${code}.png`;
  const filePath = path.join(OUTPUT_DIR, exchange, `${code}.png`);

  if (fs.existsSync(filePath)) {
    console.log(`⏭️  ${code} 已存在，跳过`);
    return true;
  }

  return new Promise(resolve => {
    const req = https.get(url, { timeout: TIMEOUT_MS }, res => {
      if (res.statusCode === 200) {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          // 简单校验是否为 PNG 文件（PNG 头部固定 8 字节）
          if (buffer.length > 8 && buffer.toString('hex', 0, 8) === '89504e470d0a1a0a') {
            fs.writeFileSync(filePath, buffer);
            console.log(`✅  ${code} 已保存到 ${exchange}/`);
            resolve(true);
          } else {
            console.log(`⚠️  ${code} 不是有效 PNG`);
            resolve(false);
          }
        });
      } else {
        console.log(`❌  ${code} HTTP ${res.statusCode}`);
        resolve(false);
      }
    });

    req.on('error', err => {
      console.log(`❌  ${code} ${err.message}`);
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      console.log(`⏰  ${code} 超时`);
      resolve(false);
    });
  });
}

// 主函数
async function run() {
  let success = 0, fail = 0;
  for (let i = 0; i < tasks.length; i++) {
    process.stdout.write(`处理 ${i + 1}/${tasks.length} (${tasks[i].code})... `);
    const ok = await downloadLogo(tasks[i]);
    if (ok) success++; else fail++;
    await new Promise(r => setTimeout(r, DELAY_MS));
  }
  console.log(`\n🎉 完成！成功 ${success}，失败 ${fail}`);
}

run();