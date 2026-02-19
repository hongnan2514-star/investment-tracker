import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// --- 调试输出开始 ---
console.log('======= fundHistoryDB 调试信息 =======');
const dbPathForDebug = path.join(process.cwd(), 'data', 'fund_history.db');
console.log('dbPath (JSON):', JSON.stringify(dbPathForDebug));
console.log('process.cwd():', process.cwd());
// 打印所有环境变量名（不包含值，避免泄露敏感信息）
console.log('环境变量列表:', Object.keys(process.env).sort().join(', '));
// 可选：如果怀疑特定变量有问题，可以打印其值（注意安全）
// 例如 console.log('MONGODB_URI:', process.env.MONGODB_URI);
console.log('======= 调试输出结束 =======\n');
// --- 调试输出结束 ---

export interface FundNav {
  code: string;
  date: string;      // YYYY-MM-DD
  nav: number;       // 单位净值
  accumNav: number;  // 累计净值
  change: number;    // 日增长率
}

const DB_PATH = path.join(process.cwd(), 'data', 'fund_history.db');

// 确保 data 目录存在
if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

// 使用 try-catch 包裹数据库初始化，捕获详细错误
let db: Database.Database;
try {
  db = new Database(DB_PATH);
} catch (err) {
  console.error('❌ 数据库打开失败，详细错误:');
  console.error(err);
  // 重新抛出错误，让应用停止
  throw err;
}

// 初始化数据库表
db.exec(`
  CREATE TABLE IF NOT EXISTS fund_info (
    code TEXT PRIMARY KEY,
    name TEXT,
    last_update TEXT
  );

  CREATE TABLE IF NOT EXISTS fund_nav_history (
    code TEXT,
    date TEXT,
    nav REAL,
    accum_nav REAL,
    change REAL,
    PRIMARY KEY (code, date)
  );

  CREATE INDEX IF NOT EXISTS idx_fund_nav_code_date ON fund_nav_history(code, date);
  CREATE INDEX IF NOT EXISTS idx_fund_nav_date ON fund_nav_history(date);
`);

// 添加 source 列（如果不存在），用于区分数据来源
const tableInfo = db.prepare(`PRAGMA table_info(fund_info)`).all() as any[];
const hasSource = tableInfo.some(col => col.name === 'source');
if (!hasSource) {
  db.exec(`ALTER TABLE fund_info ADD COLUMN source TEXT DEFAULT 'sina';`);
}

/**
 * 从新浪财经获取基金历史净值数据
 * @param code 基金代码，如 "017174"
 * @param years 获取几年数据，默认1年
 */
export async function fetchFundHistoryFromSina(code: string, years: number = 1): Promise<FundNav[]> {
  try {
    console.log(`[新浪财经] 开始获取基金 ${code} 历史数据...`);
    const url = `https://stock.finance.sina.com.cn/fundInfo/api/openapi.php/CaihuiFundInfoService.getNav`;
    const params = new URLSearchParams({
      fund: code,
      page: '1',
      num: '1000'
    });

    const response = await fetch(`${url}?${params}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Referer': 'https://finance.sina.com.cn/',
        'Connection': 'keep-alive'
      }
    });

    if (!response.ok) {
      console.error(`[新浪财经] HTTP error! status: ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    if (data.result && data.result.data && data.result.data.length > 0) {
      console.log(`[新浪财经] 获取到 ${data.result.data.length} 条原始数据`);
      
      const history: FundNav[] = data.result.data.map((item: any) => ({
        code: code,
        date: item.nav_date,
        nav: parseFloat(item.dwjz) || 0,
        accumNav: parseFloat(item.ljjz) || 0,
        change: parseFloat(item.rzzl) || 0
      }));

      history.sort((a, b) => a.date.localeCompare(b.date));

      const cutoffDate = new Date();
      cutoffDate.setFullYear(cutoffDate.getFullYear() - years);
      const cutoffStr = cutoffDate.toISOString().split('T')[0];
      
      const filteredHistory = history.filter(item => item.date >= cutoffStr);
      
      console.log(`[新浪财经] 过滤后得到 ${filteredHistory.length} 条数据`);
      return filteredHistory;
    } else {
      console.warn(`[新浪财经] 未找到基金 ${code} 的数据，完整响应:`, JSON.stringify(data).substring(0, 200));
      return [];
    }
  } catch (error) {
    console.error(`[新浪财经] 获取 ${code} 历史数据失败:`, error);
    return [];
  }
}

/**
 * 保存基金历史净值到数据库
 */
export function saveFundHistory(records: FundNav[]) {
  const insert = db.prepare(`
    INSERT OR REPLACE INTO fund_nav_history (code, date, nav, accum_nav, change)
    VALUES (?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction((records) => {
    for (const r of records) {
      insert.run(r.code, r.date, r.nav, r.accumNav, r.change);
    }
  });

  transaction(records);
}

/**
 * 获取基金历史数据
 * @param code 基金代码
 * @param days 获取最近多少天的数据，默认365天
 */
export function getFundHistory(code: string, days: number = 365): FundNav[] {
  const stmt = db.prepare(`
    SELECT * FROM fund_nav_history 
    WHERE code = ? 
    AND date >= date('now', ?)
    ORDER BY date ASC
  `);
  
  return stmt.all(code, `-${days} days`) as FundNav[];
}

/**
 * 检查是否需要更新（根据数据来源智能判断）
 */
export function needsUpdate(code: string): boolean {
  const stmt = db.prepare(`
    SELECT last_update, source FROM fund_info WHERE code = ?
  `);
  const info = stmt.get(code) as { last_update: string; source: string } | undefined;
  
  if (!info) return true; // 没有记录，需要更新

  const today = new Date().toISOString().split('T')[0];
  const last = info.last_update;

  if (info.source === 'akshare') {
    // AKShare 数据一周更新一次
    const lastDate = new Date(last);
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    return lastDate < oneWeekAgo;
  } else {
    // 默认每天更新
    return last !== today;
  }
}

/**
 * 获取基金信息（名称和来源）
 */
export function getFundInfo(code: string): { name: string; source: string } | undefined {
  const stmt = db.prepare(`SELECT name, source FROM fund_info WHERE code = ?`);
  return stmt.get(code) as { name: string; source: string } | undefined;
}

/**
 * 保存基金名称和来源（自动更新 last_update 为今天）
 * 添加错误处理和日志输出
 */
export function saveFundInfo(code: string, name: string, source: string = 'sina') {
  try {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO fund_info (code, name, last_update, source)
      VALUES (?, ?, date('now'), ?)
    `);
    stmt.run(code, name, source);
    console.log(`[DB] 基金信息保存成功: ${code} -> ${name} (来源: ${source})`);
  } catch (error) {
    console.error(`[DB] 基金信息保存失败: ${code}`, error);
  }
}

/**
 * 获取所有已存在基金代码（用于自动更新）
 */
export function getAllFundCodes(): string[] {
  const stmt = db.prepare(`SELECT code FROM fund_info`);
  const rows = stmt.all() as { code: string }[];
  return rows.map(row => row.code);
}