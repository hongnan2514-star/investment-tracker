#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import akshare as ak
import json
import sys
from datetime import datetime

def fetch_metal_history(symbol):
    """
    使用 AKShare 获取上海黄金交易所历史数据
    支持 Au99.99, Au99.95, Au(T+D), Ag99.99, Ag(T+D), Pt99.95 等
    """
    try:
        print(f"正在获取 {symbol} 历史数据...", file=sys.stderr)
        # 获取历史行情
        df = ak.spot_hist_sge(symbol=symbol)
        if df.empty:
            return {"success": False, "error": f"未找到 {symbol} 数据"}

        # 转换为列表
        records = []
        for _, row in df.iterrows():
            # 解析日期
            date_str = row['date']
            # AKShare 返回的日期格式可能是 '2020-01-01' 或类似
            try:
                datetime.strptime(date_str, '%Y-%m-%d')
            except:
                # 尝试其他格式
                date_str = str(date_str)
            
            record = {
                'date': date_str,
                'open': float(row['open']),
                'high': float(row['high']),
                'low': float(row['low']),
                'close': float(row['close']),
                'volume': float(row['volume']) if 'volume' in row else 0,
            }
            records.append(record)

        print(f"成功获取 {len(records)} 条数据", file=sys.stderr)
        return {"success": True, "data": records, "symbol": symbol}
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "缺少参数 symbol"}))
        sys.exit(1)
    
    symbol = sys.argv[1]
    result = fetch_metal_history(symbol)
    print(json.dumps(result, ensure_ascii=False))