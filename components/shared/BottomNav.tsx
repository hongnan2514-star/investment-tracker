// components/shared/BottomNav.tsx
"use client";
import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Home, PieChart, Wallet, BotMessageSquare, NotepadText, Trash2 } from 'lucide-react';
import { eventBus } from '@/src/utils/eventBus';

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isLedgerSelectMode, setIsLedgerSelectMode] = useState(false);
  const [selectedCount, setSelectedCount] = useState(0);

  useEffect(() => {
    const handleSelectModeChange = (data: { isSelectMode: boolean; selectedCount?: number }) => {
      if (pathname === '/ledger') {
        setIsLedgerSelectMode(data.isSelectMode);
        if (data.selectedCount !== undefined) setSelectedCount(data.selectedCount);
      } else {
        setIsLedgerSelectMode(false);
      }
    };
    eventBus.subscribe('selectModeChanged', handleSelectModeChange);
    return () => eventBus.unsubscribe('selectModeChanged', handleSelectModeChange);
  }, [pathname]);

  const handleSelectAll = () => {
    eventBus.emit('requestSelectAll');
  };

  const navItems = [
    { path: '/', icon: Home },
    { path: '/portfolio', icon: Wallet },
    { path: '/ledger', icon: NotepadText },
    { path: '/analytics', icon: isLedgerSelectMode ? Trash2 : BotMessageSquare },
  ];

  const firstThree = navItems.slice(0, 3);
  const lastItem = navItems[3];

  const NavButton = ({ item, className = "" }: { item: typeof navItems[0]; className?: string }) => {
    const isActive = pathname === item.path;
    const Icon = item.icon;
    const handleClick = () => {
      if (item.path === '/analytics' && isLedgerSelectMode) {
        eventBus.emit('requestDeleteSelected');
      } else {
        router.push(item.path);
      }
    };
    return (
      <button
        onClick={handleClick}
        className={`flex flex-col items-center justify-center gap-0.5 ${className}`}
      >
        <Icon
          size={25}
          className={isActive ? 'text-[#ff8800]' : 'text-gray-500 dark:text-gray-400'}
          strokeWidth={isActive ? 2.5 : 2}
        />
        <span className={`text-[10px] font-medium ${isActive ? 'text-[#ff8800]' : 'text-gray-500 dark:text-gray-400'}`} />
      </button>
    );
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 pb-safe">
      <div className="flex items-center justify-between gap-3 px-9 py-3">
        {isLedgerSelectMode && pathname === '/ledger' ? (
          <button
            onClick={handleSelectAll}
            className="w-14 h-14 bg-white/20 dark:bg-black/20 backdrop-blur-2xl backdrop-saturate-150 rounded-full shadow-2xl border border-white/40 dark:border-white/10 flex items-center justify-center text-gray-900 dark:text-gray-100 font-bold text-sm"
          >
            全选
          </button>
        ) : (
          <div className="flex-1 flex items-center justify-around bg-white/20 dark:bg-black/20 backdrop-blur-2xl backdrop-saturate-150 rounded-full shadow-2xl border border-white/40 dark:border-white/10 py-3">
            {firstThree.map((item) => (
              <NavButton key={item.path} item={item} className="flex-1" />
            ))}
          </div>
        )}
        <div className="w-14 h-14 bg-white/20 dark:bg-black/20 backdrop-blur-2xl backdrop-saturate-150 rounded-full shadow-2xl border border-white/40 dark:border-white/10 flex items-center justify-center">
          <NavButton item={lastItem} className="w-full" />
        </div>
      </div>
    </div>
  );
}