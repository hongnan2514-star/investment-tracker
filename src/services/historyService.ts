// src/services/historyService.ts
import { getAssets } from '@/src/utils/assetStorage';

// 单个历史数据点
export interface HistoryPoint {
  timestamp: number;  // 毫秒时间戳
  value: number;      // 总资产
}

const STORAGE_KEY = 'asset_history';
// 保留最近一年的数据（365天 * 24小时）
const MAX_HOURS = 24 * 365;
// 记录最小间隔（1小时），避免频繁存储
const RECORD_INTERVAL = 60 * 60 * 1000; // 1小时

// 获取完整历史
function getFullHistory(): HistoryPoint[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

// 记录当前总资产快照（带频率限制）
export function recordSnapshot(): void {
  const assets = getAssets();
  if (assets.length === 0) return;

  const total = assets.reduce((sum, asset) => sum + asset.marketValue, 0);
  const now = Date.now();

  const history = getFullHistory();
  // 如果已有数据，检查是否需要记录新点
  if (history.length > 0) {
    const lastPoint = history[history.length - 1];
    if (now - lastPoint.timestamp < RECORD_INTERVAL) {
      // 距离上次记录不足1小时，跳过
      return;
    }
  }

  // 添加新点
  history.push({ timestamp: now, value: total });

  // 清理超过 MAX_HOURS 的数据（按时间）
  const cutoff = now - MAX_HOURS * 60 * 60 * 1000;
  const filtered = history.filter(point => point.timestamp >= cutoff);

  // 保存
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

// 获取最近N小时的历史数据（默认最近一年）
export function getHistoryData(hours: number = MAX_HOURS): HistoryPoint[] {
  const history = getFullHistory();
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  return history.filter(point => point.timestamp >= cutoff);
}

// 清空历史（当资产清空时调用）
export function clearHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}