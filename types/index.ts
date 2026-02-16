export interface Asset {
    id: string
    symbol: string; // 股票代码, 如APPL
    name: string; // 公司名称
    holdings: number; //持股数量
    avgPrice: number; // 买入均价
    currentPrice: number; // 当前市价
    change: number; // 今日涨跌幅(%)
}