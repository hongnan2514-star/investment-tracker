// components/dashboard/SummaryCardSkeleton.tsx
"use client";
import React from 'react';
import { Eye } from 'lucide-react';

export default function SummaryCardSkeleton() {
  return (
    <div className="mb-6 px-2 animate-pulse">
      <div className="flex justify-between items-start">
        <div className="flex flex-col flex-1">
          <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400 mb-1">
            <span className="text-xs font-semibold">净资产估值</span>
            <div className="p-1">
              <Eye size={14} className="text-gray-400" />
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <div className="h-8 w-28 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-4 w-8 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
          <div className="mt-2">
            <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
        <div className="-ml-2 mt-2">
          <div className="h-10 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="bg-[#ff8800] dark:bg-[#ff8800] rounded-2xl py-1.5 px-3 flex items-center justify-between">
          <span className="text-xs font-medium text-white">资产</span>
          <div className="h-5 w-16 bg-white/30 rounded" />
        </div>
        <div className="bg-[#ff8800] dark:bg-[#ff8800] rounded-2xl py-1.5 px-3 flex items-center justify-between">
          <span className="text-xs font-medium text-white">负债</span>
          <div className="h-5 w-16 bg-white/30 rounded" />
        </div>
      </div>
    </div>
  );
}