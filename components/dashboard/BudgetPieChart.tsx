// components/dashboard/BudgetPieChart.tsx
"use client";
import React, { useState, useEffect, useRef } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { ChevronUp, ChevronDown, X } from 'lucide-react';
import { useTheme } from '@/app/ThemeProvider';
import { eventBus } from '@/src/utils/eventBus';

interface BudgetPieChartProps {
  budget: number;
  spent: number;
  currencySymbol: string;
  expenseByCategory?: { category: string; amount: number }[];
  totalExpense?: number;
  onBudgetUpdate?: (newBudget: number) => void; // 新增：预算更新回调
}

export default function BudgetPieChart({ 
  budget, 
  spent, 
  currencySymbol, 
  expenseByCategory = [], 
  totalExpense = spent,
  onBudgetUpdate
}: BudgetPieChartProps) {
  const { theme } = useTheme();
  const [isAmountHidden, setIsAmountHidden] = useState(false);
  const [outerRadius, setOuterRadius] = useState(45);
  const [isMobile, setIsMobile] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showBudgetMenu, setShowBudgetMenu] = useState(false); // 预算编辑菜单
  const [tempBudget, setTempBudget] = useState<string>(budget.toString());
  const resizeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const pieCenterX = 42;

  useEffect(() => {
    const unsubscribe = eventBus.subscribe('toggleAmountVisibility', (hidden: boolean) => {
      setIsAmountHidden(hidden);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = setTimeout(() => {
        const mobile = window.innerWidth < 768;
        setIsMobile(mobile);
        setOuterRadius(mobile ? 30 : 35);
      }, 150);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
    };
  }, []);

  const remaining = Math.max(budget - spent, 0);
  const isOverBudget = spent > budget;
  let remainingPercent: number;
  let spentPercentForChart: number;
  let remainingPercentForChart: number;

  if (budget === 0) {
    remainingPercent = 0;
    spentPercentForChart = 0;
    remainingPercentForChart = 1;
  } else if (isOverBudget) {
    remainingPercent = ((budget - spent) / budget) * 100;
    spentPercentForChart = 1;
    remainingPercentForChart = 0;
  } else {
    remainingPercent = (remaining / budget) * 100;
    spentPercentForChart = spent / budget;
    remainingPercentForChart = 1 - spentPercentForChart;
  }

  const pieData = [
    { name: '支出', value: spentPercentForChart, color: '#f97316' },
    { name: '剩余', value: remainingPercentForChart, color: theme === 'dark' ? '#374151' : '#e5e7eb' },
  ].filter(item => item.value > 0);

  const formatLargeNumber = (num: number): string => {
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(2) + 'K';
    return num.toFixed(2);
  };

  const categoryPieData = expenseByCategory.map(item => ({
    name: item.category,
    value: item.amount,
    percent: totalExpense > 0 ? (item.amount / totalExpense) * 100 : 0,
  })).sort((a, b) => b.value - a.value);

  const COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#f59e0b', '#ef4444', '#84cc16', '#a855f7'];
  const getColor = (index: number) => COLORS[index % COLORS.length];

  // 处理预算金额点击
  const handleBudgetClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止冒泡，避免触发展开/收起
    setTempBudget(budget.toString());
    setShowBudgetMenu(true);
  };

  // 保存新预算
  const handleSaveBudget = () => {
    const newBudget = parseFloat(tempBudget);
    if (isNaN(newBudget) || newBudget < 0) {
      alert('请输入有效的预算金额');
      return;
    }
    onBudgetUpdate?.(newBudget);
    setShowBudgetMenu(false);
  };

  // 清除预算
  const handleClearBudget = () => {
    onBudgetUpdate?.(0);
    setShowBudgetMenu(false);
  };

  if (budget === undefined || budget === null) {
    return (
      <div className="px-2 mb-2">
        <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl p-4 text-center text-gray-400 dark:text-gray-500">
          暂无预算数据
        </div>
      </div>
    );
  }

  const chartSize = outerRadius * 2 + 10;

  return (
    <>
      <div className="px-2 mb-2">
        {/* 可点击区域：展开/收起时显示或隐藏小饼图 */}
        <div className="cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
          <div className="flex flex-row items-center gap-3 justify-start flex-nowrap">
            {/* 小饼图区域 - 仅在未展开时显示 */}
            {!isExpanded && (
              <div className="flex-shrink-0">
                <div style={{ width: chartSize, height: chartSize }} className="relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx={`${pieCenterX}%`}
                        cy="50%"
                        innerRadius={outerRadius * 0.65}
                        outerRadius={outerRadius}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div
                    className="absolute top-1/2 text-center"
                    style={{
                      left: `${pieCenterX}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    {!isAmountHidden && (
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                        {remainingPercent.toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
            {/* 剩余预算文字和图标始终显示 - 金额部分可点击 */}
            <div className={`flex-1 flex flex-row justify-between items-baseline ${isExpanded ? 'mt-6' : ''}`}>
              <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">本月剩余预算：</span>
              <button
                onClick={handleBudgetClick}
                className="text-base font-bold text-gray-700 dark:text-gray-100 whitespace-nowrap hover:opacity-70 transition"
              >
                {isAmountHidden ? (
                  <span className="tracking-widest">****</span>
                ) : (
                  `${currencySymbol}${formatLargeNumber(remaining)}`
                )}
              </button>
            </div>
            <div className="flex-shrink-0">
              {isExpanded ? (
                <ChevronUp size={20} className="text-gray-500 relative top-3" />
              ) : (
                <ChevronDown size={20} className="text-gray-500" />
              )}
            </div>
          </div>
        </div>

        {/* 展开的详细内容：包含大饼图和分类明细 */}
        <div
          className={`transition-all duration-300 ease-in-out overflow-hidden ${
            isExpanded ? 'max-h-[800px] opacity-100 mt-4' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="bg-white dark:bg-black rounded-2xl p-4">
            {/* 放大版预算饼图（支出+剩余） */}
            <div className="flex justify-center mb-6">
              <div style={{ width: 220, height: 220 }} className="relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                      label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                  {!isAmountHidden && (
                    <div>
                      <div className="text-xs text-gray-500">剩余预算</div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {remainingPercent.toFixed(0)}%
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 支出分类明细 */}
            <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">支出分类明细</h4>
            {categoryPieData.length === 0 ? (
              <div className="text-center text-gray-400 py-8">暂无支出数据</div>
            ) : (
              <div className="space-y-2">
                {categoryPieData.map((item, idx) => (
                  <div key={item.name} className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getColor(idx) }} />
                      <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
                    </div>
                    <div className="text-gray-900 dark:text-gray-100 font-medium">
                      {currencySymbol}{formatLargeNumber(item.value)} ({item.percent.toFixed(1)}%)
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 底部滑出的预算编辑菜单 */}
      {showBudgetMenu && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={() => setShowBudgetMenu(false)} />
          <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#0a0a0a] rounded-t-[40px] z-50 p-6 pb-10 transition-transform duration-500 transform translate-y-0">
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-6" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">月度预算</h3>
            
            <div className="space-y-5">
              <div>
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-2">预算金额</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">{currencySymbol}</span>
                  <input
                    type="number"
                    value={tempBudget}
                    onChange={(e) => setTempBudget(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-gray-100 dark:bg-gray-800 rounded-2xl py-4 pl-8 pr-4 text-xl font-bold text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-orange-500"
                    step="0.01"
                    min="0"
                    autoFocus
                  />
                </div>
              </div>

              <button
                onClick={handleSaveBudget}
                className="w-full bg-[#ff8800] text-white font-black py-4 rounded-2xl mt-2 active:scale-[0.98] transition"
              >
                确认
              </button>

              <button
                onClick={handleClearBudget}
                className="w-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-black py-4 rounded-2xl active:scale-[0.98] transition"
              >
                清除预算
              </button>

              <button
                onClick={() => setShowBudgetMenu(false)}
                className="w-full text-gray-500 dark:text-gray-400 font-bold py-2"
              >
                取消
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}