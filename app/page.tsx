// app/page.tsx
"use client";
 
import React, { useState, useEffect, useCallback } from 'react';
import { useSwipeable } from 'react-swipeable';
import SummaryCard from '@/components/dashboard/SummaryCard';
import AssetPieChart from "@/components/dashboard/AssetPieChart";
import ProfileDrawer from "@/components/dashboard/ProfileDrawer";
import SummaryCardSkeleton from '@/components/dashboard/SummaryCardSkeleton';
import AssetPieChartSkeleton from '@/components/dashboard/AssetPieChartSkeleton';
import { User } from 'lucide-react';
import { Asset } from '@/src/constants/types';
import { getCurrentUserId } from '@/src/utils/assetStorage';
import { eventBus } from '@/src/utils/eventBus';
import { useCurrency } from '@/src/services/currency';

export default function Home() {
  const { currency, symbol } = useCurrency();
  const [user, setUser] = useState<any>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<Asset[]>([]);

  // 滑动手势处理
const swipeHandlers = useSwipeable({
  onSwipedLeft: () => setIsDrawerOpen(true),
  onSwipedRight: () => setIsDrawerOpen(false),
  preventScrollOnSwipe: true,
  trackMouse: true,
});

  // 加载用户信息
  useEffect(() => {
    const loadUser = () => {
      const storedUser = localStorage.getItem('user');
      if (storedUser) setUser(JSON.parse(storedUser));
      else setUser(null);
    };
    loadUser();
    const handleUserChange = () => loadUser();
    window.addEventListener('user-changed', handleUserChange);
    return () => window.removeEventListener('user-changed', handleUserChange);
  }, []);

  // 加载资产数据
  const loadAssets = useCallback(async () => {
    const userId = getCurrentUserId();
    if (!userId) {
      setAssets([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/asset', {
        headers: { 'x-user-id': userId },
      });
      if (!res.ok) throw new Error('加载资产失败');
      const data = await res.json();
      const normalizedData = data.map((asset: any) => ({
        ...asset,
        price: Number(asset.price),
        holdings: Number(asset.holdings),
        marketValue: Number(asset.marketValue),
        costPrice: asset.costPrice ? Number(asset.costPrice) : undefined,
        changePercent: asset.changePercent ? Number(asset.changePercent) : 0,
      }));
      setAssets(normalizedData);
    } catch (err) {
      console.error('加载资产失败', err);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始加载
  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  // 监听资产更新事件
  useEffect(() => {
    const handleAssetsUpdate = async (updatedAssets?: Asset[]) => {
      if (updatedAssets && Array.isArray(updatedAssets)) {
        setAssets(updatedAssets);
      } else {
        await loadAssets();
      }
    };
    const unsubscribe = eventBus.subscribe('assetsUpdated', handleAssetsUpdate);
    return unsubscribe;
  }, [loadAssets]);

  // 监听用户切换事件
  useEffect(() => {
    const handleUserChange = () => {
      loadAssets();
    };
    const unsubscribe = eventBus.subscribe('userChanged', handleUserChange);
    return unsubscribe;
  }, [loadAssets]);

  return (
    <main className="min-h-screen bg-white dark:bg-black p-4" {...swipeHandlers}>
      <div className="max-w-md mx-auto">
        <header className="mb-6 px-2 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">资产总览</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">您的所有资产汇总</p >
          </div>
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden hover:ring-2 ring-gray-300 dark:ring-gray-600 transition"
          >
            {user?.avatarUrl ? (
              < img src={user.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-gray-600 dark:text-gray-300 font-bold">
                {user?.name ? user.name.charAt(0).toUpperCase() : <User size={20} />}
              </span>
            )}
          </button>
        </header>

        {loading ? (
          <>
            <SummaryCardSkeleton />
            <AssetPieChartSkeleton />
          </>
        ) : (
          <>
            <SummaryCard assets={assets} />
            <AssetPieChart assets={assets} />
          </>
        )}

        <ProfileDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
      </div>
    </main>
  );
}