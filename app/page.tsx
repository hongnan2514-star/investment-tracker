// app/page.tsx
"use client";

import SummaryCard from '@/components/dashboard/SummaryCard';
import AssetPieChart from "@/components/dashboard/AssetPieChart";
import ProfileDrawer from "@/components/dashboard/ProfileDrawer";
import SummaryCardSkeleton from '@/components/dashboard/SummaryCardSkeleton';
import AssetPieChartSkeleton from '@/components/dashboard/AssetPieChartSkeleton';
import { useCurrency } from '@/src/services/currency';
import { useState, useEffect } from 'react';
import { User } from 'lucide-react';
import { eventBus } from '@/src/utils/eventBus';

export default function Home() {
  const { currency, symbol } = useCurrency();
  const [user, setUser] = useState<any>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);

  // 用户信息加载
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

  // 数据就绪检测：监听子组件的加载完成事件，或使用延时回退
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const handleDataReady = () => {
      setIsPageLoading(false);
      clearTimeout(timeoutId);
    };

    // 假设 SummaryCard 和 AssetPieChart 在首次加载完成后会触发 'homeDataReady' 事件
    // 如果尚未实现该事件，可暂时用延时方案，并后续在子组件中添加事件触发。
    const unsubscribe = eventBus.subscribe('homeDataReady', handleDataReady);

    // 安全回退：最长等待 5 秒后强制显示内容
    timeoutId = setTimeout(() => {
      setIsPageLoading(false);
    }, 5000);

    return () => {
      unsubscribe();
      clearTimeout(timeoutId);
    };
  }, []);

  return (
    <main className="min-h-screen bg-white dark:bg-black p-4">
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

        {isPageLoading ? (
          <>
            <SummaryCardSkeleton />
            <AssetPieChartSkeleton />
          </>
        ) : (
          <>
            <SummaryCard />
            <AssetPieChart />
          </>
        )}

        <ProfileDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
      </div>
    </main>
  );
}