// src/hooks/useAssetRefresh.ts
import { useEffect, useRef, useCallback } from 'react';
import { refreshAllAssets } from '@/src/services/marketService';
import { getAssets } from '@/src/utils/assetStorage';
import { isUSMarketOpen, isAStockMarketOpen, isMetalMarketOpen } from '@/src/utils/marketTime';

interface AssetExistence {
  hasCrypto: boolean;
  hasStock: boolean;
  hasMetal: boolean;
  hasFund: boolean;
}

export function useAssetRefresh({ hasCrypto, hasStock, hasMetal, hasFund }: AssetExistence) {
  const timers = useRef<{
    crypto?: NodeJS.Timeout;
    stock?: NodeJS.Timeout;
    metal?: NodeJS.Timeout;
    fund?: NodeJS.Timeout;
  }>({});

  // 刷新函数：从存储获取最新资产列表，按类型过滤后刷新
  const refreshByType = useCallback(async (types: string[]) => {
    const assets = getAssets(); // 直接从存储获取，避免闭包依赖
    const assetsToRefresh = assets.filter(a => types.includes(a.type));
    if (assetsToRefresh.length === 0) return;
    await refreshAllAssets(assetsToRefresh);
  }, []);

  // 基金每日刷新检测
  const refreshFundIfNeeded = useCallback(async () => {
    const lastFundUpdate = localStorage.getItem('lastFundUpdate');
    const today = new Date().toISOString().split('T')[0];
    if (lastFundUpdate !== today) {
      await refreshByType(['fund']);
      localStorage.setItem('lastFundUpdate', today);
    }
  }, [refreshByType]);

  // --- 加密货币：15分钟定时器 ---
  useEffect(() => {
    if (!hasCrypto) return;
    refreshByType(['crypto']);
    const id = setInterval(() => refreshByType(['crypto']), 15 * 60 * 1000);
    timers.current.crypto = id;
    return () => {
      if (timers.current.crypto) clearInterval(timers.current.crypto);
    };
  }, [hasCrypto, refreshByType]);

  // --- 股票/ETF：交易时段每5分钟 ---
  useEffect(() => {
    if (!hasStock) return;

    let intervalId: NodeJS.Timeout;
    let checkInterval: NodeJS.Timeout;

    const scheduleStockRefresh = () => {
      if (timers.current.stock) clearInterval(timers.current.stock);

      const now = new Date();
      const isAOpen = isAStockMarketOpen(now);
      const isUSOpen = isUSMarketOpen(now);

      if (isAOpen || isUSOpen) {
        intervalId = setInterval(() => refreshByType(['stock', 'etf']), 5 * 60 * 1000);
        timers.current.stock = intervalId;
        refreshByType(['stock', 'etf']); // 立即刷新一次
      } else {
        timers.current.stock = undefined;
      }
    };

    scheduleStockRefresh();
    checkInterval = setInterval(scheduleStockRefresh, 60 * 1000); // 每分钟检查交易时段

    return () => {
      if (timers.current.stock) clearInterval(timers.current.stock);
      clearInterval(checkInterval);
    };
  }, [hasStock, refreshByType]);

  // --- 贵金属：交易时段每5分钟 ---
  useEffect(() => {
    if (!hasMetal) return;

    let intervalId: NodeJS.Timeout;
    let checkInterval: NodeJS.Timeout;

    const scheduleMetalRefresh = () => {
      if (timers.current.metal) clearInterval(timers.current.metal);

      if (isMetalMarketOpen()) {
        intervalId = setInterval(() => refreshByType(['metal']), 5 * 60 * 1000);
        timers.current.metal = intervalId;
        refreshByType(['metal']);
      } else {
        timers.current.metal = undefined;
      }
    };

    scheduleMetalRefresh();
    checkInterval = setInterval(scheduleMetalRefresh, 60 * 1000);

    return () => {
      if (timers.current.metal) clearInterval(timers.current.metal);
      clearInterval(checkInterval);
    };
  }, [hasMetal, refreshByType]);

  // --- 基金：每日一次 ---
  useEffect(() => {
    if (!hasFund) return;

    refreshFundIfNeeded();
    const id = setInterval(refreshFundIfNeeded, 60 * 60 * 1000); // 每小时检查一次是否跨天
    timers.current.fund = id;

    return () => {
      if (timers.current.fund) clearInterval(timers.current.fund);
    };
  }, [hasFund, refreshFundIfNeeded]);
}