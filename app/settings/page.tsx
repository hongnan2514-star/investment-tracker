// app/settings/page.tsx
"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Lock, Bell, Moon, Info, LogOut, CircleDollarSign } from 'lucide-react';
import { setCurrentUserId, clearCurrentUserAssets } from '@/src/utils/assetStorage';
import { useTheme } from '@/app/ThemeProvider';
import { useCurrency, currencySymbols } from '@/src/services/currency';

export default function SettingsPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { currency } = useCurrency();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const user = localStorage.getItem('user');
    setIsLoggedIn(!!user);
  }, []);

  const handleLogout = () => {
    setCurrentUserId(null);
    localStorage.removeItem('user');
    clearCurrentUserAssets();
    // 触发全局用户变更事件，通知其他组件（如ProfileDrawer）更新UI
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('user-changed'));
    }
    // 退出登录后跳转到首页
    router.push('/');
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-black p-4 transition-colors duration-200">
      <header className="mb-6 flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition"
        >
          <ChevronLeft size={24} className="text-gray-600 dark:text-gray-300" />
        </button>
        <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">设置</h1>
      </header>

      <div className="bg-gray-50 dark:bg-black rounded-3xl p-6 space-y-2">
        {/* 修改密码 - 改为跳转 */}
<button
  onClick={() => {
    if (!isLoggedIn) {
      alert('请先登录');
      router.push('/profile');
      return;
    }
    router.push('/settings/change-password');
  }}
  className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-[#1a1a1a] rounded-xl"
>
  <div className="flex items-center gap-3">
    <Lock size={20} className="text-gray-500 dark:text-gray-400" />
    <span className="text-gray-700 dark:text-gray-300">修改密码</span>
  </div>
  <ChevronRight size={18} className="text-gray-400 dark:text-gray-500" />
</button>

        {/* 其他设置项保持不变 */}
        <button
          onClick={() => alert('通知设置开发中')}
          className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-[#1a1a1a]"
        >
          <div className="flex items-center gap-3">
            <Bell size={20} className="text-gray-500 dark:text-gray-400" />
            <span className="text-gray-700 dark:text-gray-300">通知设置</span>
          </div>
          <ChevronRight size={18} className="text-gray-400 dark:text-gray-500" />
        </button>

        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-[#1a1a1a]"
        >
          <div className="flex items-center gap-3">
            <Moon size={20} className="text-gray-500 dark:text-gray-400" />
            <span className="text-gray-700 dark:text-gray-300">主题设置</span>
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {theme === 'light' ? '浅色' : '深色'}
          </span>
        </button>

        <button
          onClick={() => router.push('/settings/currency')}
          className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-[#1a1a1a]"
        >
          <div className="flex items-center gap-3">
            <CircleDollarSign size={20} className="text-gray-500 dark:text-gray-400" />
            <span className="text-gray-700 dark:text-gray-300">计价货币</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {currencySymbols[currency]} {currency}
            </span>
            <ChevronRight size={18} className="text-gray-400 dark:text-gray-500" />
          </div>
        </button>

        {isLoggedIn && (
          <div className="pt-4 mt-4">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 text-red-500 dark:text-red-400 font-bold py-3 rounded-2xl border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
            >
              <LogOut size={20} />
              退出登录
            </button>
          </div>
        )}
      </div>
    </main>
  );
}