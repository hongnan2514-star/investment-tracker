#!/usr/bin/env python3
# scripts/get_astock_minute.py

import sys
import json
import argparse
import baostock as bs
import pandas as pd

def fetch_minute_data(symbol, resolution, limit, since_timestamp=None):
    """
    获取A股分钟K线数据
    :param symbol: 带后缀的代码，如 "600519.SS" 或 "000858.SZ"
    :param resolution: 分辨率，如 '15m', '30m', '60m'
    :param limit: 最大获取条数
    :param since_timestamp: 起始时间戳（毫秒），可选
    :return: 包含字段 [timestamp, open, high, low, close, volume] 的列表
    """
    # 转换代码格式：600519.SS -> sh.600519，000858.SZ -> sz.000858
    if symbol.endswith('.SS'):
        code = f"sh.{symbol[:-3]}"
    elif symbol.endswith('.SZ'):
        code = f"sz.{symbol[:-3]}"
    else:
        return {"error": "Unsupported symbol format"}

    # 分辨率映射到 BaoStock 的 frequency
    freq_map = {
        '15m': '15',
        '30m': '30',
        '60m': '60',
        '1h': '60',
    }
    freq = freq_map.get(resolution)
    if not freq:
        return {"error": f"Unsupported resolution: {resolution}"}

    # 登录 BaoStock
    lg = bs.login()
    if lg.error_code != '0':
        return {"error": f"BaoStock login failed: {lg.error_msg}"}

    try:
        # 确定开始日期和结束日期（BaoStock 需要 yyyy-mm-dd 格式）
        # 为了简单，我们根据 limit 往前推足够天数，例如 limit * 5 分钟，但分钟接口有限制
        # BaoStock 的分钟接口最多获取 1023 条，且需要指定日期范围。
        # 这里我们获取最近 limit 条数据，通过多次请求（如果 since_timestamp 提供，则获取从该时间到现在的数据）
        # 简化处理：获取最近 N 天的分钟数据（按 resolution 计算所需天数）
        import datetime

        end_date = datetime.datetime.now().strftime('%Y-%m-%d')
        # 估算起始日期：每条数据间隔 resolution 分钟，limit 条需要 resolution * limit 分钟，转换为天并加缓冲
        minutes_per_point = int(freq)
        total_minutes = minutes_per_point * limit
        total_days = total_minutes // (24*60) + 1
        start_date = (datetime.datetime.now() - datetime.timedelta(days=total_days)).strftime('%Y-%m-%d')

        # 调用 BaoStock 获取分钟 K 线
        rs = bs.query_history_k_data_plus(
            code=code,
            fields="date,time,open,high,low,close,volume",
            start_date=start_date,
            end_date=end_date,
            frequency=freq,          # 分钟线，frequency 参数需为 '5', '15', '30', '60'
            adjustflag="3"            # 不复权
        )
        if rs.error_code != '0':
            return {"error": f"BaoStock query failed: {rs.error_msg}"}

        data_list = []
        while (rs.error_code == '0') & rs.next():
            row = rs.get_row_data()
            # row 格式: [date, time, open, high, low, close, volume]
            # date 格式 yyyy-mm-dd, time 格式 HHMMSS 或 空
            date_str = row[0]
            time_str = row[1]
            if not time_str or time_str == '':
                continue
            # 组合成 datetime 字符串
            dt_str = f"{date_str} {time_str[:2]}:{time_str[2:4]}:{time_str[4:6]}"
            dt = datetime.datetime.strptime(dt_str, "%Y-%m-%d %H:%M:%S")
            timestamp = int(dt.timestamp())  # 秒级时间戳

            # 如果指定了 since_timestamp，过滤
            if since_timestamp and timestamp * 1000 < since_timestamp:
                continue

            data_list.append({
                "timestamp": timestamp,
                "open": float(row[2]),
                "high": float(row[3]),
                "low": float(row[4]),
                "close": float(row[5]),
                "volume": float(row[6]),
            })

        # 按时间升序排序
        data_list.sort(key=lambda x: x['timestamp'])
        # 限制条数
        if len(data_list) > limit:
            data_list = data_list[-limit:]

        return data_list

    finally:
        bs.logout()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--symbol', required=True)
    parser.add_argument('--resolution', required=True)
    parser.add_argument('--limit', type=int, default=288)
    parser.add_argument('--since', type=int, help='起始时间戳（毫秒）', default=None)
    args = parser.parse_args()

    result = fetch_minute_data(args.symbol, args.resolution, args.limit, args.since)
    # 输出 JSON
    print(json.dumps(result))