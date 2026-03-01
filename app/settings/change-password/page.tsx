// app/settings/change-password/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Lock } from 'lucide-react';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [userPhone, setUserPhone] = useState<string | null>(null);

  useEffect(() => {
    // 从 localStorage 获取当前登录用户的手机号
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      alert('请先登录');
      router.push('/profile');
      return;
    }
    try {
      const user = JSON.parse(userStr);
      if (user.phone) {
        setUserPhone(user.phone);
      } else {
        throw new Error('用户信息不完整');
      }
    } catch {
      alert('登录信息异常，请重新登录');
      router.push('/profile');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!oldPassword || !newPassword || !confirmPassword) {
      alert('请填写所有字段');
      return;
    }
    if (newPassword.length < 6) {
      alert('新密码至少6位');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('两次输入的新密码不一致');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: userPhone,
          oldPassword,
          newPassword,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert('密码修改成功');
        router.push('/settings');
      } else {
        alert(data.message || '修改失败');
      }
    } catch (error) {
      alert('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-black p-4">
      <header className="mb-6 flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition"
        >
          <ChevronLeft size={24} className="text-gray-600 dark:text-gray-300" />
        </button>
        <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">修改密码</h1>
      </header>

      <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl p-6 shadow-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase ml-1">
              当前密码
            </label>
            <input
              type="password"
              placeholder="请输入当前密码"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 ring-blue-500 mt-1 text-black dark:text-white font-medium"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase ml-1">
              新密码
            </label>
            <input
              type="password"
              placeholder="至少6位"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 ring-blue-500 mt-1 text-black dark:text-white font-medium"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase ml-1">
              确认新密码
            </label>
            <input
              type="password"
              placeholder="再次输入新密码"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 ring-blue-500 mt-1 text-black dark:text-white font-medium"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-blue-700 transition disabled:bg-gray-300 dark:disabled:bg-gray-600 flex items-center justify-center gap-2"
          >
            <Lock size={18} />
            {loading ? '提交中...' : '确认修改'}
          </button>
        </form>
      </div>
    </main>
  );
}