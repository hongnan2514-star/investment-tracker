"use client";
import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Home, PieChart, Wallet, User } from 'lucide-react';

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    { name: '首页', path: '/', icon: Home },
    { name: '资产', path: '/portfolio', icon: Wallet },
    { name: 'AI分析', path: '/analytics', icon: PieChart },
    { name: '我的', path: '/profile', icon: User },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-black/80 backdrop-blur-md border-t border-gray-100 dark:border-gray-800 pb-safe">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className="flex flex-col items-center justify-center w-full gap-1"
            >
              <Icon 
                size={22} 
                className={isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'} 
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span className={`text-[10px] font-bold ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>
                {item.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

