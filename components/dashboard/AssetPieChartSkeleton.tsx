// components/dashboard/AssetPieChartSkeleton.tsx
"use client";
import React from 'react';

export default function AssetPieChartSkeleton() {
  return (
    <div className="px-2 mb-6 animate-pulse">
      <div className="flex justify-between items-center mb-6">
        <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
      <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
        <div className="w-full md:w-1/2 h-72 flex items-center justify-center">
          <div className="w-40 h-40 md:w-52 md:h-52 rounded-full bg-gray-200 dark:bg-gray-700" />
        </div>
        <div className="w-full md:w-1/2 space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-gray-200 dark:bg-gray-700" />
                <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
              <div className="flex items-center gap-4">
                <div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            </div>
          ))}
          <div className="pt-4 mt-2 border-t border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}