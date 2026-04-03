// app/page.tsx
"use client";

import SummaryCard from '@/components/dashboard/SummaryCard';
import AssetPieChart from "@/components/dashboard/AssetPieChart";
import BudgetPieChart from "@/components/dashboard/BudgetPieChart";
import ProfileDrawer from "@/components/dashboard/ProfileDrawer";
import { useCurrency, useCurrencyConverter } from '@/src/services/currency';
import { useState, useEffect } from 'react';
import { User } from 'lucide-react';

export default function Home() {
  const { currency, symbol } = useCurrency();
  const { convert } = useCurrencyConverter();

  // 预算数据（示例）
  const [rawBudgetCNY] = useState(565);
  const [rawSpentCNY] = useState(0);
  const [convertedBudget, setConvertedBudget] = useState(565);
  const [convertedSpent, setConvertedSpent] = useState(0);

  // 用户状态（用于头像显示）
  const [user, setUser] = useState<any>(null);

  // 抽屉开关状态
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // 监听用户变化事件，更新头像
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

  // 货币转换预算
  useEffect(() => {
    const convertBudget = async () => {
      const budgetConverted = await convert(rawBudgetCNY, 'CNY', currency);
      const spentConverted = await convert(rawSpentCNY, 'CNY', currency);
      setConvertedBudget(budgetConverted);
      setConvertedSpent(spentConverted);
    };
    convertBudget();
  }, [currency, convert, rawBudgetCNY, rawSpentCNY]);

  return (
    <main className="min-h-screen bg-white dark:bg-black p-4">
      <div className="max-w-md mx-auto">
        {/* 头部：标题 + 圆形头像按钮 */}
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

        <SummaryCard />

        <BudgetPieChart
          budget={convertedBudget}
          spent={convertedSpent}
          currencySymbol={symbol}
        />

        <AssetPieChart />

        {/* 右侧滑出抽屉 */}
        <ProfileDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
      </div>
    </main>
  );
}