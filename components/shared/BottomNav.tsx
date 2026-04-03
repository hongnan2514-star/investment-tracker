"use client";
import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Home, PieChart, Wallet, User, BotMessageSquare } from 'lucide-react';

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    { name: '首页', path: '/', icon: Home },
    { name: '资产', path: '/portfolio', icon: Wallet },
    { name: '收支', path: '/ledger', icon: PieChart },
    { name: '分析', path: '/analytics', icon: BotMessageSquare },
  ];

  const firstThree = navItems.slice(0, 3);
  const lastItem = navItems[3];

  const NavButton = ({ item, className = "" }: { item: typeof navItems[0]; className?: string }) => {
    const isActive = pathname === item.path;
    const Icon = item.icon;
    return (
      <button
        onClick={() => router.push(item.path)}
        className={`flex flex-col items-center justify-center gap-0.5 ${className}`}
      >
        <Icon
          size={22}
          className={isActive ? 'text-[#ff8800]' : 'text-gray-500 dark:text-gray-400'}
          strokeWidth={isActive ? 2.5 : 2}
        />
        <span className={`text-[10px] font-medium ${isActive ? 'text-[#ff8800]' : 'text-gray-500 dark:text-gray-400'}`}>
          {item.name}
        </span>
      </button>
    );
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 pb-safe">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        {/* 前三个图标共用一个圆框 */}
        <div className="flex-1 flex items-center justify-around bg-white/20 dark:bg-black/20 backdrop-blur-2xl backdrop-saturate-150 rounded-full shadow-2xl border border-white/40 dark:border-white/10 py-2">
          {firstThree.map((item) => (
            <NavButton key={item.path} item={item} className="flex-1" />
          ))}
        </div>

        {/* 第四个图标单独一个正圆圆框 */}
        <div className="w-14 h-14 bg-white/20 dark:bg-black/20 backdrop-blur-2xl backdrop-saturate-150 rounded-full shadow-2xl border border-white/40 dark:border-white/10 flex items-center justify-center">
          <NavButton item={lastItem} className="w-full" />
        </div>
      </div>
    </div>
  );
}