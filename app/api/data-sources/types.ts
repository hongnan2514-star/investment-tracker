// /app/api/data-sources/types.ts
export interface UnifiedAsset {
    symbol: string;
    name: string;
    price: number | null;
    changePercent: number | null;
    currency: string;
    market?: string;
    type?: 'stock' | 'etf' | 'index' | 'crypto' | 'fund';
    source: string; // 标记数据来源,用于调试
    lastUpdated: string;
    raw?: any; // 可选: 保留原始数据用于调试
    metadata?: {
        management?: string; 
        fundType?: string;
        foundDate?: string;
        [key: string]: any;
    }
}

// 数据源查询结果
export interface DataSourceResult {
    success: boolean;
    data: UnifiedAsset | null;
    error?: string;
    source: string;
}