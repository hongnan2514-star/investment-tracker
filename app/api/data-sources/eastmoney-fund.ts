import axios from 'axios';

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
 * 从天天基金获取基金实时估值
 * @param fundCode 基金代码（如 "017174"）
 */
export async function queryEastMoneyFund(fundCode: string) {
  console.log(`\n=== [天天基金] 开始获取基金实时数据: ${fundCode} ===`);

  try {
    // 天天基金实时估值接口（返回 JSONP）
    const url = `http://fundgz.1234567.com.cn/js/${fundCode}.js`;
    console.log(`[天天基金] 请求 URL: ${url}`);

    const response = await axios.get(url, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    // 处理 JSONP 格式：jsonpgz({...});
    const jsonpText = response.data;
    const jsonStr = jsonpText.replace(/^jsonpgz\(/, '').replace(/\);$/, '');
    const data: FundRealtime = JSON.parse(jsonStr);

    if (!data || !data.fundcode) {
      console.error(`[天天基金] 返回数据格式错误:`, data);
      return null;
    }

    console.log(`[天天基金] 获取成功: ${data.name} 净值: ${data.dwjz} (${data.jzrq})`);

    // 转换为统一格式
    return {
      symbol: `${data.fundcode}.OF`,
      name: data.name,
      price: parseFloat(data.dwjz),
      changePercent: parseFloat(data.gszzl),
      currency: 'CNY',
      market: '中国基金市场',
      type: 'fund',
      source: 'EastMoney',
      lastUpdated: new Date(data.jzrq).toISOString(),
      navDate: data.jzrq,
    };
  } catch (error: any) {
    console.error(`[天天基金] 获取失败:`, error.message);
    return null;
  }
}