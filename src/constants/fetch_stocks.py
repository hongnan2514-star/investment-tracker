#!/usr/bin/env python3
import akshare as ak
import json

def get_all_a_shares():
    """使用 AkShare 获取所有 A 股"""
    stock_map = {}
    
    try:
        # 获取沪市A股
        stock_sh = ak.stock_info_sh_name_code()
        for _, row in stock_sh.iterrows():
            code = row['代码']
            name = row['简称']
            if code.startswith('6'):
                stock_map[f"{code}.SS"] = name
        
        # 获取深市A股（主板、创业板）
        stock_sz = ak.stock_info_sz_name_code()
        for _, row in stock_sz.iterrows():
            code = row['A股代码']
            name = row['A股简称']
            if pd.isna(code) or pd.isna(name):
                continue
            code = str(int(code)).zfill(6)
            if code.startswith('0') or code.startswith('3'):
                stock_map[f"{code}.SZ"] = name
        
        # 获取科创板
        stock_kcb = ak.stock_info_kcb_name_code()
        for _, row in stock_kcb.iterrows():
            code = row['code']
            name = row['name']
            if code.startswith('688'):
                stock_map[f"{code}.SS"] = name
        
        # 获取北交所（可选）
        stock_bj = ak.stock_info_bj_name_code()
        for _, row in stock_bj.iterrows():
            code = row['证券代码']
            name = row['证券简称']
            stock_map[f"{code}.BJ"] = name
            
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
    
    return stock_map

if __name__ == "__main__":
    stock_map = get_all_a_shares()
    print(json.dumps(stock_map, ensure_ascii=False))