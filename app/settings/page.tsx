// app/settings/page.tsx
"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Lock, Bell, Moon, Info, LogOut } from 'lucide-react';
import { setCurrentUserId, clearCurrentUserAssets } from '@/src/utils/assetStorage';
import { useTheme } from '@/app/ThemeProvider';
import { useCurrency, currencySymbols } from '@/src/services/currency'; // 新增导入

export default function SettingsPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { currency } = useCurrency(); // 获取当前货币
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    const user = localStorage.getItem('user');
    setIsLoggedIn(!!user);
  }, []);

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      alert('密码至少6位');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('两次输入的密码不一致');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        alert('密码修改成功');
        setShowChangePassword(false);
        setNewPassword('');
        setConfirmPassword('');
      } else {
        alert(data.message || '修改失败');
      }
    } catch (error) {
      alert('网络错误');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setCurrentUserId(null);
    localStorage.removeItem('user');
    clearCurrentUserAssets();
    router.push('/profile');
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

      <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl p-6 shadow-md space-y-2">
        {/* 修改密码 */}
        <div className="border-b border-gray-100 dark:border-gray-700 pb-2">
          <button
            onClick={() => {
              if (!isLoggedIn) {
                alert('请先登录');
                router.push('/profile');
                return;
              }
              setShowChangePassword(!showChangePassword);
            }}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-[#1a1a1a] rounded-xl"
          >
            <div className="flex items-center gap-3">
              <Lock size={20} className="text-gray-500 dark:text-gray-400" />
              <span className="text-gray-700 dark:text-gray-300">修改密码</span>
            </div>
            <ChevronRight size={18} className="text-gray-400 dark:text-gray-500" />
          </button>
          {showChangePassword && isLoggedIn && (
            <div className="mt-3 p-3 bg-gray-50 dark:bg-[#1a1a1a] rounded-xl space-y-3">
              <input
                type="password"
                placeholder="新密码（至少6位）"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-white dark:bg-black p-3 rounded-xl border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 ring-blue-500 text-black dark:text-white"
              />
              <input
                type="password"
                placeholder="确认新密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-white dark:bg-black p-3 rounded-xl border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 ring-blue-500 text-black dark:text-white"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleChangePassword}
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white font-bold py-2 rounded-xl hover:bg-blue-700 transition disabled:bg-gray-300 dark:disabled:bg-gray-600"
                >
                  确认
                </button>
                <button
                  onClick={() => setShowChangePassword(false)}
                  className="flex-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 font-bold py-2 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-500 transition"
                >
                  取消
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 通知设置 */}
        <button
          onClick={() => alert('通知设置开发中')}
          className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-[#1a1a1a] rounded-xl border-b border-gray-100 dark:border-gray-700"
        >
          <div className="flex items-center gap-3">
            <Bell size={20} className="text-gray-500 dark:text-gray-400" />
            <span className="text-gray-700 dark:text-gray-300">通知设置</span>
          </div>
          <ChevronRight size={18} className="text-gray-400 dark:text-gray-500" />
        </button>

        {/* 主题设置 */}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-[#1a1a1a] rounded-xl border-b border-gray-100 dark:border-gray-700"
        >
          <div className="flex items-center gap-3">
            <Moon size={20} className="text-gray-500 dark:text-gray-400" />
            <span className="text-gray-700 dark:text-gray-300">主题设置</span>
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {theme === 'light' ? '浅色' : '深色'}
          </span>
        </button>

        {/* 计价货币 - 新增 */}
        <button
          onClick={() => router.push('/settings/currency')}
          className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-[#1a1a1a] rounded-xl border-b border-gray-100 dark:border-gray-700"
        >
          <div className="flex items-center gap-3">
            <span className="text-gray-500 dark:text-gray-400 text-xl">💰</span>
            <span className="text-gray-700 dark:text-gray-300">计价货币</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {currencySymbols[currency]} {currency}
            </span>
            <ChevronRight size={18} className="text-gray-400 dark:text-gray-500" />
          </div>
        </button>

        {/* 关于我们 */}
        <button
          onClick={() => alert('投资追踪 v1.0.0')}
          className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-[#1a1a1a] rounded-xl"
        >
          <div className="flex items-center gap-3">
            <Info size={20} className="text-gray-500 dark:text-gray-400" />
            <span className="text-gray-700 dark:text-gray-300">关于我们</span>
          </div>
          <ChevronRight size={18} className="text-gray-400 dark:text-gray-500" />
        </button>

        {/* 退出登录 */}
        {isLoggedIn && (
          <div className="pt-4 mt-4 border-t border-gray-100 dark:border-gray-700">
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