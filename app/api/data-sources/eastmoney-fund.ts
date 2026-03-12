import axios from 'axios';
import { FundNav } from '@/src/services/fundHistoryDB';

// 用户代理池（可扩展）
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
];

// 随机获取UA
const getRandomUserAgent = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

interface FundRealtime {
  fundcode: string;  // 基金代码
  name: string;      // 基金名称
  jzrq: string;      // 净值日期 (YYYY-MM-DD)
  dwjz: string;      // 单位净值
  gsz: string;       // 估算净值
  gszzl: string;     // 估算涨跌幅 (%)
  gztime: string;    // 估值时间
}

/**
 * 从天天基金获取基金实时估值（带重试）
 * @param fundCode 基金代码
 * @param retries 重试次数，默认2次
 */
export async function queryEastMoneyFund(fundCode: string, retries = 2): Promise<FundRealtime | null> {
  const url = `http://fundgz.1234567.com.cn/js/${fundCode}.js`;
  const timeout = 10000; // 10秒超时

  for (let i = 0; i <= retries; i++) {
    try {
      const response = await axios.get(url, {
        timeout,
        headers: { 'User-Agent': getRandomUserAgent() },
      });

      const jsonpText = response.data;
      const jsonStr = jsonpText.replace(/^jsonpgz\(/, '').replace(/\);$/, '');
      const data: FundRealtime = JSON.parse(jsonStr);

      if (!data || !data.fundcode) {
        throw new Error('返回数据格式错误');
      }

      console.log(`[天天基金] 获取成功: ${data.name} 净值: ${data.dwjz}`);
      return data;
    } catch (error: any) {
      console.log(`[天天基金] 第 ${i + 1} 次尝试失败: ${error.message}`);
      if (i === retries) {
        console.error(`[天天基金] 最终失败: ${fundCode}`);
        return null;
      }
      // 指数退避：等待 1s, 2s, 4s...
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
  return null;
}

/**
 * 从天天基金获取基金全量历史净值数据
 * @param fundCode 基金代码（纯数字）
 * @returns FundNav 数组，如果失败返回 null
 */
export async function fetchFundHistoryFromEastMoney(fundCode: string): Promise<FundNav[] | null> {
  console.log(`[天天基金历史] 开始获取基金 ${fundCode} 全量历史数据...`);
  try {
    const url = `http://fund.eastmoney.com/pingzhongdata/${fundCode}.js`;
    const response = await axios.get(url, { timeout: 15000 });
    const jsContent = response.data;

    // 提取单位净值趋势数据
    const match = jsContent.match(/var Data_netWorthTrend\s*=\s*(\[[\s\S]*?\]);/);
    if (!match) {
      console.warn(`[天天基金历史] 未找到净值数据 for ${fundCode}`);
      return null;
    }

    const rawData = JSON.parse(match[1]);
    const history: FundNav[] = rawData.map((item: any) => ({
      code: fundCode,
      date: new Date(item.x).toISOString().split('T')[0],
      nav: item.y,
      accumNav: 0,
      change: item.equityReturn || 0,
    }));

    console.log(`[天天基金历史] 成功获取 ${fundCode} 历史数据 ${history.length} 条`);
    return history;
  } catch (error) {
    console.error(`[天天基金历史] 获取 ${fundCode} 历史数据失败:`, error);
    return null;
  }
}