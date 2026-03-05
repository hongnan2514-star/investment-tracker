// importCryptoData.js
require('dotenv').config({ path: '.env.local' });
const fs = require('fs').promises;
const path = require('path');
const { neon } = require('@neondatabase/serverless');
const AdmZip = require('adm-zip');

const sql = neon(process.env.POSTGRES_URL);

// ===== 配置区域 =====
// 数据存放目录：项目根目录下的 downloaded_data 文件夹
const DATA_DIR = path.join(__dirname, 'downloaded_data');
// 需要导入的交易对（BNB和OKB已加入，可继续添加）
const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'OKBUSDT', 'SOLUSDT', 'ADAUSDT', 'XRPUSDT', 'DOTUSDT', 'DOGEUSDT', 'AVAXUSDT'];
// 需要导入的K线周期
const RESOLUTIONS = ['15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d'];
// ====================

function msToSeconds(ms) {
  return Math.floor(ms / 1000);
}

function formatSymbol(sym) {
  return sym.replace('USDT', '/USDT');
}

async function insertMinuteBatch(records) {
  if (records.length === 0) return;
  const symbols = records.map(r => r.symbol);
  const timestamps = records.map(r => r.timestamp);
  const resolutions = records.map(r => r.resolution);
  const opens = records.map(r => r.open);
  const highs = records.map(r => r.high);
  const lows = records.map(r => r.low);
  const closes = records.map(r => r.close);
  const volumes = records.map(r => r.volume);

  await sql.query(`
    INSERT INTO crypto_minute_history (symbol, timestamp, resolution, open, high, low, close, volume)
    SELECT * FROM UNNEST($1::text[], $2::bigint[], $3::text[], $4::numeric[], $5::numeric[], $6::numeric[], $7::numeric[], $8::numeric[])
    ON CONFLICT (symbol, timestamp, resolution) DO NOTHING;
  `, [symbols, timestamps, resolutions, opens, highs, lows, closes, volumes]);

  console.log(`  插入 ${records.length} 条分钟数据`);
}

async function insertDailyBatch(records) {
  if (records.length === 0) return;
  const symbols = records.map(r => r.symbol);
  const dates = records.map(r => r.date);
  const opens = records.map(r => r.open);
  const highs = records.map(r => r.high);
  const lows = records.map(r => r.low);
  const closes = records.map(r => r.close);
  const volumes = records.map(r => r.volume);

  await sql.query(`
    INSERT INTO crypto_price_history (symbol, date, open, high, low, close, volume)
    SELECT * FROM UNNEST($1::text[], $2::date[], $3::numeric[], $4::numeric[], $5::numeric[], $6::numeric[], $7::numeric[])
    ON CONFLICT (symbol, date) DO NOTHING;
  `, [symbols, dates, opens, highs, lows, closes, volumes]);

  console.log(`  插入 ${records.length} 条日线数据`);
}

async function processFile(filePath) {
  const fileName = path.basename(filePath);
  const match = fileName.match(/^([A-Z]+)-([^-]+)-(\d{4}-\d{2})\.zip$/);
  if (!match) {
    console.warn(`跳过文件，文件名格式不匹配: ${fileName}`);
    return;
  }
  const symbol = match[1];
  const resolution = match[2];
  const yearMonth = match[3];

  //if (!SYMBOLS.includes(symbol)) return;
  if (!RESOLUTIONS.includes(resolution)) return;

  console.log(`处理文件: ${fileName} (${symbol} ${resolution} ${yearMonth})`);

  try {
    const zip = new AdmZip(filePath);
    const zipEntries = zip.getEntries();
    const csvEntry = zipEntries.find(entry => entry.entryName.endsWith('.csv'));
    if (!csvEntry) {
      console.warn(`  ZIP 中未找到 CSV 文件: ${fileName}`);
      return;
    }

    const csvData = csvEntry.getData().toString('utf8');
    const lines = csvData.split('\n').filter(line => line.trim() !== '');
    const hasHeader = /[a-zA-Z]/.test(lines[0]);
    const records = [];

    for (let i = hasHeader ? 1 : 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split(',');
      if (parts.length < 6) continue;

      const openTime = parseInt(parts[0]);
      const open = parseFloat(parts[1]);
      const high = parseFloat(parts[2]);
      const low = parseFloat(parts[3]);
      const close = parseFloat(parts[4]);
      const volume = parseFloat(parts[5]);

      const timestamp = msToSeconds(openTime);

      if (resolution === '1d') {
        const date = new Date(timestamp * 1000).toISOString().split('T')[0];
        records.push({
          symbol: formatSymbol(symbol),
          date,
          open,
          high,
          low,
          close,
          volume,
        });
      } else {
        records.push({
          symbol: formatSymbol(symbol),
          timestamp,
          resolution,
          open,
          high,
          low,
          close,
          volume,
        });
      }

      if (records.length >= 1000) {
        const batch = records.splice(0, 1000);
        if (resolution === '1d') {
          await insertDailyBatch(batch);
        } else {
          await insertMinuteBatch(batch);
        }
      }
    }

    if (records.length > 0) {
      if (resolution === '1d') {
        await insertDailyBatch(records);
      } else {
        await insertMinuteBatch(records);
      }
    }

    console.log(`  完成: ${fileName}`);
  } catch (error) {
    console.error(`处理文件失败: ${fileName}`, error);
  }
}

async function importAll() {
  try {
    // 确保目录存在，如果不存在则创建
    await fs.mkdir(DATA_DIR, { recursive: true });
    const files = await fs.readdir(DATA_DIR);
    const zipFiles = files.filter(f => f.endsWith('.zip')).sort();
    console.log(`找到 ${zipFiles.length} 个 ZIP 文件`);

    for (const zipFile of zipFiles) {
      const filePath = path.join(DATA_DIR, zipFile);
      await processFile(filePath);
    }

    console.log('所有数据导入完成！');
  } catch (error) {
    console.error('读取目录失败:', error);
  }
}

importAll().catch(console.error);