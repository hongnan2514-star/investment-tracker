const fs = require('fs');
const path = require('path');
const axios = require('axios');

// 方法1：从东方财富网获取完整股票列表
async function fetchFromEastmoney() {
  try {
    // 获取沪市A股
    const shResponse = await axios.get('http://80.push2.eastmoney.com/api/qt/clist/get', {
      params: {
        pn: 1,
        pz: 10000,
        fs: 'm:1 s:1',
        fields: 'f12,f14',
        _: Date.now()
      }
    });
    
    // 获取深市A股
    const szResponse = await axios.get('http://80.push2.eastmoney.com/api/qt/clist/get', {
      params: {
        pn: 1,
        pz: 10000,
        fs: 'm:0 t:6,m:0 t:13,m:0 t:80',
        fields: 'f12,f14',
        _: Date.now()
      }
    });
    
    const stockMap = {};
    
    // 处理沪市股票
    if (shResponse.data.data && shResponse.data.data.diff) {
      shResponse.data.data.diff.forEach(stock => {
        const code = stock.f12;
        const name = stock.f14;
        if (code.startsWith('6')) {
          stockMap[`${code}.SS`] = name;
        }
      });
    }
    
    // 处理深市股票
    if (szResponse.data.data && szResponse.data.data.diff) {
      szResponse.data.data.diff.forEach(stock => {
        const code = stock.f12;
        const name = stock.f14;
        if (code.startsWith('0') || code.startsWith('3')) {
          stockMap[`${code}.SZ`] = name;
        }
      });
    }
    
    return stockMap;
  } catch (error) {
    console.error('Error fetching from Eastmoney:', error);
    return {};
  }
}

// 方法2：使用 AkShare（通过 Python 脚本）
async function fetchFromAkShare() {
  const { spawn } = require('child_process');
  
  return new Promise((resolve) => {
    const pythonProcess = spawn('python', ['fetch_stocks.py']);
    let data = '';
    
    pythonProcess.stdout.on('data', (chunk) => {
      data += chunk.toString();
    });
    
    pythonProcess.on('close', () => {
      try {
        const stockMap = JSON.parse(data);
        resolve(stockMap);
      } catch (e) {
        console.error('Error parsing AkShare data:', e);
        resolve({});
      }
    });
  });
}

// 方法3：从新浪财经获取
async function fetchFromSina() {
  try {
    const response = await axios.get('http://hq.sinajs.cn/list=sh000001,sz399001');
    // 解析新浪返回的数据格式
    // 实际需要分批获取所有股票
    const stockMap = {};
    
    // 这里需要循环获取所有股票代码
    // 新浪的批量接口：http://hq.sinajs.cn/list=s_sh000001,s_sz399001,s_sh600519...
    
    return stockMap;
  } catch (error) {
    console.error('Error fetching from Sina:', error);
    return {};
  }
}

// 生成 TypeScript 文件
function generateTypeScriptFile(stockMap) {
  const filePath = path.join(__dirname, 'src/AShareNameMap.ts');
  
  const content = `// 自动生成时间：${new Date().toISOString()}
// 股票总数：${Object.keys(stockMap).length}

export const AShareNameMap: Record<string, string> = ${JSON.stringify(stockMap, null, 2)};

export const getStockName = (symbol: string): string => {
  return AShareNameMap[symbol] || symbol;
};

export const getAllStocks = (): Array<{symbol: string, name: string}> => {
  return Object.entries(AShareNameMap).map(([symbol, name]) => ({
    symbol,
    name
  }));
};
`;
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ 已更新 ${Object.keys(stockMap).length} 只股票到 ${filePath}`);
}

// 主函数
async function main() {
  console.log('开始更新股票映射表...');
  
  // 选择数据源
  const stockMap = await fetchFromEastmoney();
  // 或者使用：const stockMap = await fetchFromAkShare();
  
  if (Object.keys(stockMap).length > 0) {
    generateTypeScriptFile(stockMap);
  } else {
    console.log('⚠️ 未能获取到股票数据');
  }
}

// 立即执行
main();