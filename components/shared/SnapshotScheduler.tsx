// components/shared/SnapshotScheduler.tsx
"use client";

import { useEffect, useRef, useCallback } from 'react';
import { getCurrentUserId } from '@/src/utils/assetStorage';
import { eventBus } from '@/src/utils/eventBus';

export default function SnapshotScheduler() {
  const isRecording = useRef(false);

  const recordSnapshot = useCallback(async () => {
    if (isRecording.current) return;
    isRecording.current = true;

    try {
      const userId = getCurrentUserId();
      if (!userId) {
        console.warn('[快照] 未登录，跳过记录');
        return;
      }

      // 从后端 API 获取最新的资产数据（包含已更新的价格）
      const assetsResponse = await fetch('/api/asset', {
        headers: { 'x-user-id': userId },
      });
      if (!assetsResponse.ok) {
        console.error('[快照] 获取资产失败');
        return;
      }
      const assets = await assetsResponse.json();
      if (!assets || assets.length === 0) {
        console.warn('[快照] 无资产，跳过记录');
        return;
      }

      const response = await fetch('/api/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, assets }),
      });
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ 快照已记录 (净资产: ${data.netWorth} CNY)`);
      } else {
        const errorText = await response.text();
        console.error('❌ 快照记录失败:', errorText);
      }
    } catch (error) {
      console.error('快照API请求失败:', error);
    } finally {
      isRecording.current = false;
    }
  }, []);

  useEffect(() => {
    recordSnapshot();

    const interval = setInterval(() => recordSnapshot(), 60 * 60 * 1000);

    const unsubscribe = eventBus.subscribe('assetsUpdated', () => {
      recordSnapshot();
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        recordSnapshot();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [recordSnapshot]);

  return null;
}