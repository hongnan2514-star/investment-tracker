export interface ChartCacheData {
  time: string;
  value: number;
}

export const chartCache = new Map<string, { data: ChartCacheData[]; timestamp: number }>();
export const CHART_CACHE_TTL = 15 * 60 * 1000; // 15分钟