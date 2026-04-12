'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');

  // 应用主题样式，可选择是否持久化
  const applyTheme = (newTheme: Theme, save: boolean = false) => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    if (newTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    if (save) {
      localStorage.setItem('theme', newTheme);
    }
  };

  // 手动切换主题（用户主动操作，保存）
  const toggleTheme = () => {
    setTheme(prev => {
      const newTheme = prev === 'light' ? 'dark' : 'light';
      applyTheme(newTheme, true);
      return newTheme;
    });
  };

  // 手动设置主题（如设置页面调用，保存）
  const handleSetTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    applyTheme(newTheme, true);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const stored = localStorage.getItem('theme') as Theme | null;
    if (stored && (stored === 'light' || stored === 'dark')) {
      // 用户曾经手动设置过主题，使用保存的值
      setTheme(stored);
      applyTheme(stored, false); // 不重复保存
    } else {
      // 没有保存过主题，强制使用浅色
      setTheme('light');
      applyTheme('light', false);
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme: handleSetTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}