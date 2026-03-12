import dotenv from 'dotenv';
import path from 'path';

// 首先加载环境变量
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

if (!process.env.POSTGRES_URL) {
  throw new Error('❌ POSTGRES_URL 未在 .env.local 中设置，请检查环境变量文件');
}

// 导入类型（仅用于类型标注）
import type { FundNav } from '../src/services/fundHistoryDB';

async function run() {
  // 动态导入 axios 和数据库服务
  const axios = (await import('axios')).default;
  const { saveFundHistory } = await import('../src/services/fundHistoryDB');

  // 需要下载的基金代码列表（可替换为你需要的）
  const FUND_CODES = ['017174', '000001', '110022'];

  async function downloadFundHistory(fundCode: string) {
    try {
      const url = `http://fund.eastmoney.com/pingzhongdata/${fundCode}.js`;
      console.log(`开始下载基金 ${fundCode} 历史数据...`);
      const response = await axios.get(url, { timeout: 15000 });
      const jsContent = response.data;

      // 提取单位净值趋势数据（不使用 /s 标志）
      const match = jsContent.match(/var Data_netWorthTrend\s*=\s*(\[[\s\S]*?\]);/);
      if (!match) {
        console.error(`基金 ${fundCode} 未找到净值数据，可能代码无效`);
        return;
      }

      const rawData = JSON.parse(match[1]);

      // 转换为数据库格式
      const history: FundNav[] = rawData.map((item: any) => ({
        code: fundCode,
        date: new Date(item.x).toISOString().split('T')[0],
        nav: item.y,
        accumNav: 0, // 如需要累计净值，可另行提取 Data_ACWorthTrend
        change: 0,   // 日增长率可在存入后由前端计算
      }));

      if (history.length === 0) {
        console.log(`基金 ${fundCode} 无历史数据`);
        return;
      }

      // 保存到数据库
      await saveFundHistory(history);
      console.log(`基金 ${fundCode} 已保存 ${history.length} 条历史数据`);
    } catch (error) {
      console.error(`下载基金 ${fundCode} 失败:`, error);
    }
  }

  console.log('开始批量下载基金历史数据...');
  for (const code of FUND_CODES) {
    await downloadFundHistory(code);
    // 避免请求过快，适当延迟
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  console.log('全部完成');
}

run().catch(console.error);