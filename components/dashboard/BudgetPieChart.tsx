// components/dashboard/BudgetPieChart.tsx
"use client";
import React, { useState, useEffect, useRef } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { useTheme } from '@/app/ThemeProvider';
import { eventBus } from '@/src/utils/eventBus';

interface BudgetPieChartProps {
  budget: number;
  spent: number;
  currencySymbol: string;
  expenseByCategory?: { category: string; amount: number }[];
  totalExpense?: number;
  onBudgetUpdate?: (newBudget: number) => void;
}

// 基于字符串生成稳定的颜色（色相0-360，饱和度70%，亮度60%）
const getColorForType = (type: string): string => {
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < type.length; i++) {
    const ch = type.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hash = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 60%)`;
};

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
  const [showBudgetMenu, setShowBudgetMenu] = useState(false);
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

  // 支出切片使用稳定随机色，剩余切片使用固定灰色（根据主题）
  const expenseColor = getColorForType('expense');
  const remainingColor = theme === 'dark' ? '#374151' : '#e5e7eb';

  // 小饼图数据（总支出 vs 剩余）
  const pieData = [
    { name: '支出', value: spentPercentForChart, color: expenseColor },
    { name: '剩余', value: remainingPercentForChart, color: remainingColor },
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

  // 大饼图数据：各支出分类 + 剩余预算（如果有）
  const detailedPieData = (() => {
    if (budget <= 0) return [];
    
    // 各分类占预算的比例
    const categorySlices = categoryPieData.map(cat => ({
      name: cat.name,
      value: cat.value / budget,
      color: getColorForType(cat.name),
      actualAmount: cat.value,
    }));

    // 剩余预算切片
    const remainingValue = remaining / budget;
    const slices = [...categorySlices];
    if (remainingValue > 0.001) {
      slices.push({
        name: '剩余预算',
        value: remainingValue,
        color: remainingColor,
        actualAmount: remaining,
      });
    }

    // 过滤掉值过小的切片（避免显示问题）
    return slices.filter(s => s.value > 0.001);
  })();

  const handleBudgetClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTempBudget(budget.toString());
    setShowBudgetMenu(true);
  };

  const handleSaveBudget = () => {
    const newBudget = parseFloat(tempBudget);
    if (isNaN(newBudget) || newBudget < 0) {
      alert('请输入有效的预算金额');
      return;
    }
    onBudgetUpdate?.(newBudget);
    setShowBudgetMenu(false);
  };

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
        <div className="cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
          <div className="flex flex-row items-center gap-3 justify-start flex-nowrap">
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

        <div
          className={`transition-all duration-300 ease-in-out overflow-hidden ${
            isExpanded ? 'max-h-[800px] opacity-100 mt-4' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="bg-white dark:bg-black rounded-2xl p-4">
            {/* 放大版预算饼图：展示各支出分类 + 剩余预算 */}
            <div className="flex justify-center mb-6">
              <div style={{ width: 220, height: 220 }} className="relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={detailedPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                      label={({ name, value, cx, cy, outerRadius, startAngle, endAngle }) => {
                        const percentValue = value; // value 已经是相对预算的比例
                        if (percentValue < 0.03) return null;
                        const RADIAN = Math.PI / 180;
                        const midAngle = (startAngle + endAngle) / 2;
                        const radius = outerRadius + 45;
                        const x = cx + radius * Math.cos(midAngle * RADIAN);
                        const y = cy + radius * Math.sin(midAngle * RADIAN);
                        let textAnchor: 'start' | 'middle' | 'end' = 'middle';
                        if (midAngle > 270 || midAngle < 90) textAnchor = 'start';
                        else if (midAngle > 90 && midAngle < 270) textAnchor = 'end';
                        const labelColor = theme === 'dark' ? '#e5e7eb' : '#1f2937';
                        return (
                          <text
                            x={x}
                            y={y}
                            fill={labelColor}
                            textAnchor={textAnchor}
                            dominantBaseline="middle"
                            fontSize={12}
                            fontWeight="600"
                          >
                            {`${name} ${(percentValue * 100).toFixed(1)}%`}
                          </text>
                        );
                      }}
                      labelLine={false}
                    >
                      {detailedPieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
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
                {categoryPieData.map((item) => (
                  <div key={item.name} className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: getColorForType(item.name) }}
                      />
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