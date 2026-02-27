import { useState, useEffect } from 'react';
import { eventBus } from '@/src/utils/eventBus';

export interface UserInfo {
  phone: string;
  name: string;
  avatarUrl: string;
  preferredCurrency: string;
}

export function useUser() {
  const [user, setUser] = useState<UserInfo | null>(null);

  const loadUser = () => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch (e) {
        console.error('解析用户信息失败', e);
        setUser(null);
      }
    } else {
      setUser(null);
    }
  };

  useEffect(() => {
    loadUser();
    const unsubscribe = eventBus.subscribe('userChanged', loadUser);
    return () => unsubscribe();
  }, []);

  const updateUser = async (updates: Partial<UserInfo>) => {
    if (!user) return;
    const updated = { ...user, ...updates };
    // 更新本地存储
    localStorage.setItem('user', JSON.stringify(updated));
    setUser(updated);
    // 同步到服务器
    try {
      const res = await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: user.phone, ...updates }),
      });
      const data = await res.json();
      if (data.success) {
        // 用服务器返回的最新数据更新本地（确保一致性）
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
      }
    } catch (error) {
      console.error('同步用户信息失败', error);
      // 可重试或提示用户
    }
    eventBus.emit('userChanged', user.phone);
  };

  return { user, updateUser };
}