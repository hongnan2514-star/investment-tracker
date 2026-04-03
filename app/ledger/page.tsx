// app/ledger/page.tsx
"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Wallet,
  TrendingUp,
  TrendingDown,
  MoreVertical,
  CalendarDays,
  Plus,
  X,
  ChevronRight,
} from 'lucide-react';
import { useTheme } from '../ThemeProvider';
import { useCurrency } from '@/src/services/currency';
import BudgetPieChart from '@/components/dashboard/BudgetPieChart';

// 交易记录类型
type Transaction = {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  note: string;
  date: string; // YYYY-MM-DD
};

// 默认分类
const INCOME_CATEGORIES = ['工资', '兼职', '理财', '红包', '其他'];
const EXPENSE_CATEGORIES = ['餐饮', '购物', '交通', '娱乐', '医疗', '房租', '其他'];

// 每月预算（示例，后续可改为用户自定义）
const MONTHLY_BUDGET = 565;

export default function LedgerPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const { symbol: currencySymbol } = useCurrency();
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(3);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addType, setAddType] = useState<'income' | 'expense'>('expense');
  const [formAmount, setFormAmount] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));

  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

  const currentMonthTransactions = transactions.filter(t => {
    const [year, month] = t.date.split('-');
    return parseInt(year) === currentYear && parseInt(month) === currentMonth + 1;
  });
  const totalIncome = currentMonthTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = currentMonthTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const netBalance = totalIncome - totalExpense;

  const openMonthPicker = () => {
    const existingPicker = document.querySelector('.temp-month-picker');
    if (existingPicker) existingPicker.remove();

    const input = document.createElement('input');
    input.type = 'month';
    input.className = 'temp-month-picker';
    const monthValue = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    input.value = monthValue;

    input.style.position = 'fixed';
    input.style.top = '-100px';
    input.style.left = '-100px';
    input.style.opacity = '0';
    input.style.pointerEvents = 'none';
    document.body.appendChild(input);

    const handleChange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const newValue = target.value;
      if (newValue) {
        const [year, month] = newValue.split('-');
        const parsedYear = parseInt(year, 10);
        const parsedMonth = parseInt(month, 10) - 1;
        if (!isNaN(parsedYear) && !isNaN(parsedMonth) && parsedMonth >= 0 && parsedMonth <= 11) {
          setCurrentYear(parsedYear);
          setCurrentMonth(parsedMonth);
        }
      }
      input.removeEventListener('change', handleChange);
      input.remove();
    };

    input.addEventListener('change', handleChange);
    window.addEventListener('focus', () => {
      if (document.body.contains(input)) input.remove();
    }, { once: true });

    try {
      if (input.showPicker) input.showPicker();
      else input.click();
    } catch (err) {
      console.warn('无法打开月份选择器', err);
      input.remove();
    }
  };

  const handleAddTransaction = () => {
    const amountNum = parseFloat(formAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('请输入有效金额');
      return;
    }
    if (!formCategory) {
      alert('请选择分类');
      return;
    }
    const newTransaction: Transaction = {
      id: Date.now().toString(),
      type: addType,
      amount: amountNum,
      category: formCategory,
      note: formNote.trim() || '',
      date: formDate,
    };
    setTransactions(prev => [newTransaction, ...prev]);
    setFormAmount('');
    setFormCategory('');
    setFormNote('');
    setFormDate(new Date().toISOString().slice(0, 10));
    setShowAddForm(false);
    setShowAddMenu(false);
  };

  const openAddForm = (type: 'income' | 'expense') => {
    setAddType(type);
    setFormCategory(type === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]);
    setShowAddMenu(false);
    setShowAddForm(true);
  };

  const groupedTransactions = currentMonthTransactions.reduce((groups, tx) => {
    const date = tx.date;
    if (!groups[date]) groups[date] = [];
    groups[date].push(tx);
    return groups;
  }, {} as Record<string, Transaction[]>);
  const sortedDates = Object.keys(groupedTransactions).sort().reverse();

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-black p-4 relative">
      <div className="max-w-md mx-auto">
        {/* 顶部栏 */}
<div className="flex justify-between items-center mb-4 px-2">
  <div>
    <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">收支</h1>
    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">管理并添加您的收支状况</p >
  </div>
  <button className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition">
    <MoreVertical size={20} className="text-gray-600 dark:text-gray-400" />
  </button>
</div>

        {/* 搜索框 */}
        <div className="relative mb-6 px-2">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
          <input
            type="text"
            placeholder="输入关键词"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="w-full bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-3xl py-2 pl-12 pr-4 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>

        {/* 主要区域：左侧日期 + 竖线 + 右侧统计信息 */}
        <div className="flex items-start gap-3 mb-6 px-2">
          <div className="flex flex-col shrink-0">
            <span className="text-sm text-gray-500 dark:text-gray-400">{currentYear}年</span>
            <div className="flex items-center gap-0 mt-0.5">
              <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {monthNames[currentMonth]}
              </span>
              <button
                onClick={openMonthPicker}
                className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition"
                aria-label="选择年月"
              >
                <CalendarDays size={18} className="text-gray-500 dark:text-gray-400 translate-y-0.5 -m-1" />
              </button>
            </div>
          </div>
          <div className="w-px h-12 bg-gray-300 dark:bg-gray-700 self-center"></div>
          <div>
            <div>
              <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-xs">
                <span>月结余</span>
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {currencySymbol}{netBalance.toFixed(2)}
              </p>
            </div>
            <div className="flex gap-4 mt-1 text-sm">
              <div className="flex items-center gap-1">
                <span className="text-gray-500 dark:text-gray-400 text-xs">支出</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {currencySymbol}{totalExpense.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-500 dark:text-gray-400 text-xs">收入</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {currencySymbol}{totalIncome.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 预算饼图组件 */}
        <BudgetPieChart
          budget={MONTHLY_BUDGET}
          spent={totalExpense}
          currencySymbol={currencySymbol}
        />

        {/* 交易列表区域 - 无数据时无白色容器 */}
        {sortedDates.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 dark:text-gray-500 font-medium">暂无收支记录</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">点击右下角 + 记录收支</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 mb-20">
            <div className="space-y-4">
              {sortedDates.map(date => {
                const dayTransactions = groupedTransactions[date];
                const dayTotalExpense = dayTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
                const dayTotalIncome = dayTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
                return (
                  <div key={date} className="border-b border-gray-100 dark:border-gray-800 last:border-0 pb-3">
                    <div className="flex justify-between items-center mb-2 px-1">
                      <span className="text-sm font-bold text-gray-500 dark:text-gray-400">
                        {date.slice(5)}  {new Date(date).toLocaleDateString('zh-CN', { weekday: 'short' })}
                      </span>
                      <div className="flex gap-3 text-xs">
                        {dayTotalExpense > 0 && <span className="text-red-500">支出 {currencySymbol}{dayTotalExpense.toFixed(2)}</span>}
                        {dayTotalIncome > 0 && <span className="text-green-500">收入 {currencySymbol}{dayTotalIncome.toFixed(2)}</span>}
                      </div>
                    </div>
                    <div className="space-y-2">
                      {dayTransactions.map(tx => (
                        <div key={tx.id} className="flex justify-between items-center py-1 px-1">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${tx.type === 'income' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                              {tx.type === 'income' ? <TrendingUp size={16} className="text-green-600" /> : <TrendingDown size={16} className="text-red-600" />}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 dark:text-gray-100">{tx.category}</p>
                              {tx.note && <p className="text-xs text-gray-400 dark:text-gray-500">{tx.note}</p>}
                            </div>
                          </div>
                          <p className={`font-bold ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                            {tx.type === 'income' ? '+' : '-'}{currencySymbol}{tx.amount.toFixed(2)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 右下角添加按钮 */}
      <button
        onClick={() => setShowAddMenu(true)}
        className="fixed bottom-24 right-6 w-16 h-16 bg-[#ff8800] rounded-full shadow-2xl shadow-blue-200 dark:shadow-blue-900/30 flex items-center justify-center text-white z-40 active:scale-90 transition-transform"
      >
        <Plus size={36} strokeWidth={3} />
      </button>

      {/* 底部菜单 */}
      {showAddMenu && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 transition-opacity" onClick={() => setShowAddMenu(false)} />
          <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#0a0a0a] rounded-t-[40px] z-50 p-8 pb-12 transition-transform duration-500 ease-in-out transform translate-y-0">
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-8" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">选择类型</h3>
            <div className="flex flex-col gap-4">
              <button
                onClick={() => openAddForm('income')}
                className="flex items-center justify-between p-5 bg-green-50 dark:bg-green-900/30 rounded-[28px] border border-green-100 dark:border-green-800 group active:scale-[0.98] transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-green-600 p-3 rounded-2xl text-white shadow-lg shadow-green-200 dark:shadow-green-900/20">
                    <TrendingUp size={24} />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-green-900 dark:text-green-300 text-lg">收入</p>
                    <p className="text-xs text-green-600/70 dark:text-green-400/70 font-medium">工资、理财、红包等</p>
                  </div>
                </div>
                <ChevronRight className="text-green-300 dark:text-green-500 group-active:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => openAddForm('expense')}
                className="flex items-center justify-between p-5 bg-red-50 dark:bg-red-900/30 rounded-[28px] border border-red-100 dark:border-red-800 group active:scale-[0.98] transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-red-600 p-3 rounded-2xl text-white shadow-lg shadow-red-200 dark:shadow-red-900/20">
                    <TrendingDown size={24} />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-red-900 dark:text-red-300 text-lg">支出</p>
                    <p className="text-xs text-red-600/70 dark:text-red-400/70 font-medium">餐饮、购物、交通等</p>
                  </div>
                </div>
                <ChevronRight className="text-red-300 dark:text-red-500 group-active:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* 添加表单浮层 */}
      {showAddForm && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={() => setShowAddForm(false)} />
          <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#0a0a0a] rounded-t-[40px] z-50 p-6 pb-10 max-h-[85vh] overflow-y-auto transition-transform duration-500">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {addType === 'income' ? '记收入' : '记支出'}
              </h3>
              <button onClick={() => setShowAddForm(false)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                <X size={24} className="text-gray-500" />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-1">金额</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">{currencySymbol}</span>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full bg-gray-100 dark:bg-gray-800 rounded-2xl py-4 pl-8 pr-4 text-xl font-bold text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-blue-500"
                    step="0.01"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-1">分类</label>
                <div className="flex flex-wrap gap-2">
                  {(addType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(cat => (
                    <button
                      key={cat}
                      onClick={() => setFormCategory(cat)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                        formCategory === cat
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-1">日期</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full bg-gray-100 dark:bg-gray-800 rounded-2xl py-3 px-4 text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-blue-500"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-1">备注（可选）</label>
                <input
                  type="text"
                  placeholder="例如：午餐、工资"
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  className="w-full bg-gray-100 dark:bg-gray-800 rounded-2xl py-3 px-4 text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-blue-500"
                />
              </div>

              <button
                onClick={handleAddTransaction}
                className="w-full bg-[#ff8800] text-white font-black py-4 rounded-2xl mt-4 active:scale-[0.98] transition"
              >
                确认添加
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}