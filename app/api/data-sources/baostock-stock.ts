// app/api/data-sources/baostock-stock.ts
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { StockMinute } from '@/src/services/fundHistoryDB';

const execAsync = promisify(exec);

export async function fetchAStockMinuteDataFromBaoStock(
  symbol: string,
  resolution: string,
  limit: number = 288,
  sinceTimestamp?: number
): Promise<StockMinute[]> {
  const scriptPath = path.join(process.cwd(), 'scripts', 'get_astock_minute.py');
  
  // 使用虚拟环境中的 Python 解释器
  const pythonPath = path.join(process.cwd(), '.venv', 'bin', 'python3');
  
  const args = [
    `--symbol="${symbol}"`,
    `--resolution="${resolution}"`,
    `--limit=${limit}`,
  ];
  if (sinceTimestamp) {
    args.push(`--since=${sinceTimestamp}`);
  }

  const command = `${pythonPath} ${scriptPath} ${args.join(' ')}`;

  console.log(`[BaoStock] 执行命令: ${command}`);

  try {
    const { stdout, stderr } = await execAsync(command, { maxBuffer: 10 * 1024 * 1024 }); // 增大 buffer

    if (stderr) {
      console.error(`[BaoStock] stderr: ${stderr}`);
    }

    const result = JSON.parse(stdout);
    if (result.error) {
      console.error(`[BaoStock] 错误: ${result.error}`);
      return [];
    }

    // 转换为 StockMinute 格式
    const records: StockMinute[] = result.map((item: any) => ({
      symbol,
      timestamp: item.timestamp,
      resolution,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volume,
    }));

    console.log(`[BaoStock] 获取到 ${records.length} 条数据`);
    return records;
  } catch (error) {
    console.error('[BaoStock] 执行失败:', error);
    return [];
  }
}