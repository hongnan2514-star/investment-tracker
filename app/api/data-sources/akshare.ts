import { DataSourceResult, UnifiedAsset } from "./types";
import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);

/**
 * 调用 Python 脚本获取基金数据
 * @param symbol 基金代码
 * @return 统一格式的基金数据
 */
export async function queryAKShareFund(symbol: string): Promise<DataSourceResult> {
    console.log(`\n=== [AKShare] 开始处理基金查询: ${symbol} ===`);

    // 清理代码，移除可能的后缀
    const cleanedSymbol = symbol.replace(/(\.OF|\.SS|\.SZ)$/, '');
    console.log(`[AKShare] 清理后的基金代码: ${cleanedSymbol}`);

    try {
        // 1. 构建 Python 脚本（关键修正版）
        const pythonScript = `
import akshare as ak
import json
import pandas as pd
import sys
from datetime import datetime

fund_code = "${cleanedSymbol}"
result = {}

def safe_float(value, default=0.0):
    """安全转换为浮点数，处理空字符串、None、NaN等"""
    if value is None:
        return default
    if pd.isna(value):
        return default
    if isinstance(value, str):
        value = value.strip()
        if value == '' or value == '%':
            return default
    try:
        return float(value)
    except (ValueError, TypeError):
        return default

try:
    # ===== 1. 从全市场快照获取最新净值 =====
    print("正在获取全市场基金最新净值...", file=sys.stderr)
    df = ak.fund_open_fund_daily_em()
    
    if df.empty:
        result = {"success": False, "error": "未能获取基金净值数据"}
        print(json.dumps(result, ensure_ascii=False))
        exit(1)
    
    # 筛选当前基金
    fund_row = df[df['基金代码'] == fund_code]
    if fund_row.empty:
        result = {"success": False, "error": f"未找到基金代码 {fund_code}"}
        print(json.dumps(result, ensure_ascii=False))
        exit(1)
    
    fund = fund_row.iloc[0]
    
    # 提取基金简称
    fund_name = fund.get('基金简称', '未知基金')
    if pd.isna(fund_name):
        fund_name = '未知基金'
    print(f"基金简称: {fund_name}", file=sys.stderr)
    
    # 获取最新净值日期和单位净值（从快照）
    nav_columns = [col for col in df.columns if col.endswith('-单位净值')]
    nav_columns.sort(reverse=True)
    latest_nav_col = nav_columns[0]
    nav_date = latest_nav_col.replace('-单位净值', '')
    
    latest_nav = safe_float(fund.get(latest_nav_col, 0))
    daily_change = safe_float(fund.get('日增长率', 0))
    
    print(f"快照净值: {latest_nav} (日期: {nav_date})", file=sys.stderr)
    print(f"快照日增长率: {daily_change}%", file=sys.stderr)
    
    # ===== 2. 如果净值为0，尝试从历史净值接口获取最近有效净值 =====
    if latest_nav == 0:
        print("快照净值为0，尝试从历史净值接口获取...", file=sys.stderr)
        try:
            # 尝试多种参数名（根据AKShare版本）
            hist_df = None
            for param in ['symbol', 'fund', 'code', 'fund_code']:
                try:
                    hist_df = ak.fund_open_fund_hist_em(**{param: fund_code})
                    if hist_df is not None and not hist_df.empty:
                        print(f"历史净值接口使用参数: {param}", file=sys.stderr)
                        break
                except Exception:
                    continue
            
            if hist_df is not None and not hist_df.empty:
                # 按净值日期降序
                hist_df = hist_df.sort_values('净值日期', ascending=False)
                # 查找第一个单位净值 > 0 的记录
                for _, row in hist_df.iterrows():
                    hist_nav = safe_float(row.get('单位净值', 0))
                    if hist_nav > 0:
                        latest_nav = hist_nav
                        nav_date = row.get('净值日期', nav_date)
                        # 如果历史数据中有日增长率，也一并更新
                        hist_change = safe_float(row.get('日增长率', 0))
                        if hist_change != 0:
                            daily_change = hist_change
                        print(f"从历史数据获取到有效净值: {latest_nav} (日期: {nav_date})", file=sys.stderr)
                        break
                else:
                    print("历史数据中未找到有效净值", file=sys.stderr)
            else:
                print("历史净值接口未返回数据", file=sys.stderr)
        except Exception as e:
            print(f"历史净值获取失败: {e}", file=sys.stderr)
    
    # ===== 3. 组装返回数据 =====
    fund_nav = {
        "单位净值": latest_nav,
        "净值日期": nav_date
    }
    
    fund_info = {
        "基金简称": fund_name,
        "基金代码": fund_code,
        "净值日期": nav_date,
        "单位净值": latest_nav,
        "日增长率": daily_change
    }
    
    result = {
        "success": True,
        "data": {
            "info": fund_info,
            "nav": fund_nav,
            "daily_change": daily_change,
            "fund_name": fund_name
        },
        "akshare_version": ak.__version__
    }
    
except Exception as e:
    import traceback
    result = {
        "success": False,
        "error": str(e),
        "traceback": traceback.format_exc()
    }

print(json.dumps(result, ensure_ascii=False, default=str))
`;

        // 2. 执行 Python 脚本
        console.log(`[AKShare] 执行 Python 脚本查询基金数据...`); 
        const projectRoot = process.cwd();
        const pythonPath = `${projectRoot}/.venv/bin/python`;

        const { stdout, stderr } = await execPromise(`${pythonPath} -c '${pythonScript.replace(/'/g, "'\"'\"'")}'`);

        // 检查stderr（调试信息）
        if (stderr && stderr.trim()) {
            // 过滤掉常见的警告信息
            const filteredStderr = stderr.split('\n')
                .filter(line => !line.includes('WARNING:') && !line.includes('DeprecationWarning'))
                .join('\n');
            if (filteredStderr.trim()) {
                console.log(`[AKShare] Python调试信息: ${filteredStderr}`);
            }
        }

        // 清理stdout，确保只取最后一行（JSON数据）
        const stdoutLines = stdout.trim().split('\n');
        const jsonLine = stdoutLines[stdoutLines.length - 1];
        
        console.log(`[AKShare] Python脚本原始输出: ${stdout.substring(0, 200)}...`);
        const result = JSON.parse(jsonLine);

        // 3. 处理查询失败
        if (!result.success) {
            console.error(`[AKShare] Python脚本执行失败: ${result.error}`);
            return {
                success: false,
                data: null,
                error: `AKShare查询失败: ${result.error}`,
                source: 'AKShare'
            };
        }

        // 4. 解析并格式化基金数据
const fundInfo = result.data.info;
const fundNav = result.data.nav;
const dailyChange = result.data.daily_change || 0;
const fundName = result.data.fund_name || fundInfo['基金简称'] || '未知基金';

// 最新净值 - 已经由 Python 脚本转换为数字，但再加一层保护
let latestPrice = 0;
if (fundNav && fundNav['单位净值'] !== undefined && fundNav['单位净值'] !== null && fundNav['单位净值'] !== '') {
    latestPrice = parseFloat(fundNav['单位净值'].toString()) || 0;
}

// 净值日期
const navDate = fundNav['净值日期'] || new Date().toISOString().split('T')[0];

// 5. 组装返回数据
const asset: UnifiedAsset = {
    symbol: `${cleanedSymbol}.OF`,
    name: fundName,
    price: latestPrice,
    changePercent: dailyChange,
    currency: 'CNY',
    market: '中国场外基金市场',
    type: 'fund',
    source: 'AKShare',
    lastUpdated: `${navDate}T15:00:00.000Z`,
    metadata: {
        rawInfo: fundInfo,
        rawNav: fundNav,
        akshareVersion: result.akshare_version
    }
};

        console.log(`[AKShare] 成功获取基金数据:`, JSON.stringify(asset, null, 2));
        console.log(`=== [AKShare] 查询处理完成 ===\n`);

        return {
            success: true,
            data: asset,
            source: 'AKShare'
        };
        
    } catch (error: any) {
        console.error(`\n=== [AKShare] 查询处理异常 ===`, error);
        return {
            success: false,
            data: null,
            error: `AKShare查询失败: ${error.message}`,
            source: 'AKShare'
        };
    }
}