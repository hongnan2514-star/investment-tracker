// app/ledger/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
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
  Banknote,
  Loader2,
  ChevronDown
} from 'lucide-react';
import { useTheme } from '../ThemeProvider';
import { useCurrency } from '@/src/services/currency';
import BudgetPieChart from '@/components/dashboard/BudgetPieChart';
import { getCurrentUserId } from '@/src/utils/assetStorage';
import { eventBus } from '@/src/utils/eventBus';
import Image from 'next/image';
import CategorySelector from '@/components/CategorySelector';
import TransactionList from '@/components/TransactionList';

type Transaction = {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  note: string;
  date: string;
  accountSymbol: string;
  accountName: string;
  accountLogoUrl?: string;
  accountBalanceAfter: number;
};

const MONTHLY_BUDGET = 565;

interface AccountAsset {
  symbol: string;
  name: string;
  marketValue: number;
  currency: string;
  logoUrl?: string;
  type: string;
}

// 交易列表骨架屏组件
function SummarySkeleton() {
  return (
    <div className="flex items-start gap-3 mb-6 px-2 animate-pulse">
      <div className="flex flex-col shrink-0">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-12 mb-2" />
        <div className="flex items-center gap-0 mt-0.5">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16" />
          <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded-full ml-1" />
        </div>
      </div>
      <div className="w-px h-12 bg-gray-300 dark:bg-gray-700 self-center" />
      <div>
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12 mb-2" />
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2" />
        <div className="flex gap-4 mt-1">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
        </div>
      </div>
    </div>
  );
}

// 饼图骨架屏
function PieChartSkeleton() {
  return <div className="h-32 w-full" />;
}
// 交易列表骨架屏（已有）
function TransactionSkeleton() {
  return (
    <div className="space-y-3 mb-20">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="bg-white dark:bg-[#0a0a0a] rounded-2xl p-3 shadow-sm border border-gray-100 dark:border-gray-800 animate-pulse">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16" />
                </div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32 mt-1" />
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-24 mt-1" />
              </div>
            </div>
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-16" />
          </div>
          <div className="mt-2 h-3 bg-gray-200 dark:bg-gray-700 rounded w-32 ml-auto" />
        </div>
      ))}
    </div>
  );
}

export default function LedgerPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const { symbol: currencySymbol } = useCurrency();
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(3);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showAccountSelector, setShowAccountSelector] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addType, setAddType] = useState<'income' | 'expense'>('expense');
  const [formAmount, setFormAmount] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));

  // 月份选择弹窗
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [tempYear, setTempYear] = useState(currentYear);
  const [tempMonth, setTempMonth] = useState(currentMonth);

  // 分类选择器
  const [showCategorySelector, setShowCategorySelector] = useState(false);

  const [accounts, setAccounts] = useState<AccountAsset[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(true); // 新增交易加载状态
  const [selectedAccount, setSelectedAccount] = useState<AccountAsset | null>(null);
  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

  // 生成年份范围（当前年份前后5年）
  const yearOptions = Array.from({ length: 201 }, (_, i) => currentYear - 100 + i);
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);

  const loadAccounts = useCallback(async () => {
    const userId = getCurrentUserId();
    if (!userId) {
      setAccounts([]);
      return;
    }
    setLoadingAccounts(true);
    try {
      const res = await fetch('/api/asset', {
        headers: { 'x-user-id': userId },
      });
      if (!res.ok) throw new Error('加载账户失败');
      const data = await res.json();
      const cashAccounts = data
        .filter((asset: any) => asset.type === 'custom')
        .map((asset: any) => ({
          ...asset,
          marketValue: Number(asset.marketValue) || 0,
          price: Number(asset.price) || 0,
        }));
      setAccounts(cashAccounts);
      if (cashAccounts.length > 0 && !selectedAccount) {
        setSelectedAccount(cashAccounts[0]);
      }
    } catch (err) {
      console.error('加载账户失败', err);
      setAccounts([]);
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  const loadAllTransactions = useCallback(async () => {
    const userId = getCurrentUserId();
    if (!userId || accounts.length === 0) {
      setAllTransactions([]);
      setLoadingTransactions(false);
      return;
    }
    setLoadingTransactions(true);
    try {
      const fetchPromises = accounts.map(account =>
        fetch(`/api/transaction?assetSymbol=${encodeURIComponent(account.symbol)}`, {
          headers: { 'x-user-id': userId },
        }).then(res => res.ok ? res.json() : [])
      );
      const results = await Promise.all(fetchPromises);

      const enriched: Transaction[] = [];
      for (let idx = 0; idx < accounts.length; idx++) {
        const account = accounts[idx];
        const txs = results[idx];
        if (!txs || txs.length === 0) continue;

        const sorted = [...txs].sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime());
        const descending = [...sorted].reverse();
        let currentBalance = account.marketValue;
        for (const tx of descending) {
          const isIncome = tx.transaction_type === 'buy';
          const amountNum = Number(tx.price);
          const balanceAfter = currentBalance;
          if (isIncome) {
            currentBalance = currentBalance - amountNum;
          } else {
            currentBalance = currentBalance + amountNum;
          }
          enriched.push({
            id: tx.id.toString(),
            type: isIncome ? 'income' : 'expense',
            amount: amountNum,
            category: tx.category || '其他',
            note: tx.note || '',
            date: tx.transaction_date,
            accountSymbol: account.symbol,
            accountName: account.name,
            accountLogoUrl: account.logoUrl,
            accountBalanceAfter: balanceAfter,
          });
        }
      }
      enriched.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setAllTransactions(enriched);
    } catch (err) {
      console.error('加载交易记录失败', err);
      setAllTransactions([]);
    } finally {
      setLoadingTransactions(false);
    }
  }, [accounts]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    if (accounts.length > 0) {
      loadAllTransactions();
    } else {
      setAllTransactions([]);
      setLoadingTransactions(false);
    }
  }, [accounts, loadAllTransactions]);

  useEffect(() => {
    const handleUserChange = () => loadAccounts();
    window.addEventListener('user-changed', handleUserChange);
    const unsubscribe = eventBus.subscribe('assetsUpdated', () => loadAccounts());
    return () => {
      window.removeEventListener('user-changed', handleUserChange);
      unsubscribe();
    };
  }, [loadAccounts]);

  const currentMonthTransactions = allTransactions.filter(t => {
    const [year, month] = t.date.split('-');
    return parseInt(year) === currentYear && parseInt(month) === currentMonth + 1;
  });
  const totalIncome = currentMonthTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = currentMonthTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const netBalance = totalIncome - totalExpense;

  const openMonthPicker = () => {
    setTempYear(currentYear);
    setTempMonth(currentMonth);
    setShowMonthPicker(true);
  };

  const confirmMonth = () => {
    setCurrentYear(tempYear);
    setCurrentMonth(tempMonth);
    setShowMonthPicker(false);
  };

  const updateAccountBalance = async (account: AccountAsset, amount: number, isIncome: boolean) => {
    const userId = getCurrentUserId();
    if (!userId) return false;
    const newAmount = isIncome ? account.marketValue + amount : account.marketValue - amount;
    if (newAmount < 0) {
      alert('账户余额不足');
      return false;
    }
    try {
      const res = await fetch('/api/asset', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          symbol: account.symbol,
          holdings: 1,
          marketValue: newAmount,
          costPrice: newAmount,
        }),
      });
      if (!res.ok) throw new Error('更新账户失败');
      eventBus.emit('assetsUpdated');
      return true;
    } catch (err) {
      console.error('更新账户余额失败', err);
      alert('更新账户失败，请重试');
      return false;
    }
  };

  const handleAddTransaction = async () => {
    const amountNum = parseFloat(formAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('请输入有效金额');
      return;
    }
    if (!formCategory) {
      alert('请选择分类');
      return;
    }
    if (!selectedAccount) {
      alert('请选择账户');
      return;
    }

    const success = await updateAccountBalance(selectedAccount, amountNum, addType === 'income');
    if (!success) return;

    const userId = getCurrentUserId();
    if (userId) {
      try {
        await fetch('/api/transaction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
          body: JSON.stringify({
            assetSymbol: selectedAccount.symbol,
            transactionType: addType === 'income' ? 'buy' : 'sell',
            quantity: 1,
            price: amountNum,
            transactionDate: formDate,
            currency: currencySymbol,
            category: formCategory,
            note: formNote,
          }),
        });
        await loadAccounts();
        await loadAllTransactions();
      } catch (err) {
        console.error('保存交易记录失败', err);
        alert('保存交易记录失败，但账户余额已更新');
      }
    }

    setFormAmount('');
    setFormCategory('');
    setFormNote('');
    setFormDate(new Date().toISOString().slice(0, 10));
    setShowAddForm(false);
    setShowAddMenu(false);
    setSelectedAccount(accounts[0] || null);
  };

  const handleSelectType = (type: 'income' | 'expense') => {
    setAddType(type);
    setFormCategory('');
    setShowAddMenu(false);
    setShowAccountSelector(true);
    if (accounts.length === 0) {
      loadAccounts();
    }
  };

  const handleSelectAccount = (account: AccountAsset) => {
    setSelectedAccount(account);
    setShowAccountSelector(false);
    setShowAddForm(true);
  };

  const handleSelectCategory = (category: string) => {
    setFormCategory(category);
    setShowCategorySelector(false);
  };

  const sortedTransactions = [...currentMonthTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

return (
  <main className="min-h-screen bg-white dark:bg-black p-4 relative">
    <div className="max-w-md mx-auto">
      <div className="flex justify-between items-center mb-4 px-2">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">收支</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">管理并添加您的收支状况</p>
        </div>
        <button className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition">
          <MoreVertical size={20} className="text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      <div className="relative mb-6 px-2">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
        <input
          type="text"
          placeholder="查找账单"
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          className="w-full bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-3xl py-2 pl-12 pr-4 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 transition"
        />
      </div>

      {/* 汇总区域 - 条件渲染 */}
      {loadingTransactions ? (
        <SummarySkeleton />
      ) : (
        <div className="flex items-start gap-3 mb-6 px-2">
          <div onClick={openMonthPicker} className="flex flex-col shrink-0 cursor-pointer">
            <span className="text-sm text-gray-500 dark:text-gray-400">{currentYear}年</span>
            <div className="flex items-center gap-0 mt-0.5">
              <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">{monthNames[currentMonth]}</span>
              <ChevronDown size={18} className="translate-x-1 text-gray-500 dark:text-gray-400 translate-y-2 -m-1" />
            </div>
          </div>
          <div className="w-px h-12 bg-gray-300 dark:bg-gray-700 self-center"></div>
          <div>
            <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-xs">
              <span>月结余</span>
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {currencySymbol}{netBalance.toFixed(2)}
            </p>
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
      )}

      {/* 饼图区域 - 条件渲染 */}
      <div className="-mt-6">
        {loadingTransactions ? (
          <PieChartSkeleton />
        ) : (
          <BudgetPieChart budget={MONTHLY_BUDGET} spent={totalExpense} currencySymbol={currencySymbol} />
        )}
      </div>

      {/* 交易列表区域 - 条件渲染 */}
      {loadingTransactions ? (
        <TransactionSkeleton />
      ) : (
        <TransactionList
          transactions={sortedTransactions}
          currencySymbol={currencySymbol}
          emptyMessage="暂无收支记录"
        />
      )}
    </div>

    {/* 右下角添加按钮 */}
    <button
      onClick={() => setShowAddMenu(true)}
      className="fixed bottom-24 right-6 w-16 h-16 bg-[#ff8800] rounded-full shadow-2xl shadow-blue-200 dark:shadow-blue-900/30 flex items-center justify-center text-white z-40 active:scale-90 transition-transform"
    >
      <Plus size={36} strokeWidth={3} />
    </button>

    {/* 底部菜单：选择收入/支出 */}
    {showAddMenu && (
      <>
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 transition-opacity" onClick={() => setShowAddMenu(false)} />
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#0a0a0a] rounded-t-[40px] z-50 p-8 pb-12 transition-transform duration-500 ease-in-out transform translate-y-0">
          <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-8" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">选择类型</h3>
          <div className="flex flex-col gap-4">
            <button
              onClick={() => handleSelectType('income')}
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
              onClick={() => handleSelectType('expense')}
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

    {/* 账户选择浮层 */}
    {showAccountSelector && (
      <>
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={() => setShowAccountSelector(false)} />
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#0a0a0a] rounded-t-[40px] z-50 p-6 pb-10 max-h-[70vh] overflow-y-auto transition-transform duration-500">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">选择账户</h3>
            <button onClick={() => setShowAccountSelector(false)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
              <X size={24} className="text-gray-500" />
            </button>
          </div>
          {loadingAccounts ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="w-full flex items-center gap-3 p-4 bg-gray-50 dark:bg-[#1a1a1a] rounded-2xl animate-pulse">
                  <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                  </div>
                  <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-500 dark:text-gray-400">暂无收支账户</p>
              <p className="text-xs text-gray-400 mt-1">请先在资产管理中添加收支账户</p>
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map(acc => (
                <button
                  key={acc.symbol}
                  onClick={() => handleSelectAccount(acc)}
                  className="w-full flex items-center gap-3 p-4 bg-gray-50 dark:bg-[#1a1a1a] rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                >
                  <div className="w-10 h-10 flex items-center justify-center">
                    {acc.logoUrl ? (
                      <Image src={acc.logoUrl} alt={acc.name} width={40} height={40} className="object-contain rounded-2xl" />
                    ) : (
                      <Banknote size={32} className="text-orange-600" />
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-bold text-gray-900 dark:text-gray-100">{acc.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      余额 {currencySymbol}{acc.marketValue.toFixed(2)}
                    </p>
                  </div>
                  <ChevronRight size={20} className="text-gray-400" />
                </button>
              ))}
            </div>
          )}
        </div>
      </>
    )}

    {/* 添加表单浮层 */}
    {showAddForm && selectedAccount && (
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
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-1">账户</label>
              <div className="flex items-center gap-3 bg-gray-100 dark:bg-gray-800 rounded-2xl p-3">
                <div className="w-8 h-8 flex items-center justify-center">
                  {selectedAccount.logoUrl ? (
                    <Image src={selectedAccount.logoUrl} alt="" width={32} height={32} className="object-contain rounded-xl" />
                  ) : (
                    <Banknote size={24} className="text-orange-600" />
                  )}
                </div>
                <div>
                  <p className="font-bold text-gray-900 dark:text-gray-100">{selectedAccount.name}</p>
                  <p className="text-xs text-gray-500">余额 {currencySymbol}{selectedAccount.marketValue.toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-1">金额</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">{currencySymbol}</span>
                <input
                  type="number"
                  placeholder="0.00"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  className="w-full bg-gray-100 dark:bg-gray-800 rounded-2xl py-4 pl-8 pr-4 text-xl font-bold text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-orange-500"
                  step="0.01"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-1">分类</label>
              <button
                onClick={() => setShowCategorySelector(true)}
                className="w-full text-left bg-gray-100 dark:bg-gray-800 rounded-2xl py-3 px-4 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 ring-orange-500"
              >
                {formCategory || '点击选择分类'}
              </button>
            </div>

            <div>
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-1">日期</label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full bg-gray-100 dark:bg-gray-800 rounded-2xl py-3 px-4 text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-orange-500"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-1">备注（可选）</label>
              <input
                type="text"
                placeholder="例如：午餐、工资"
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                className="w-full bg-gray-100 dark:bg-gray-800 rounded-2xl py-3 px-4 text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-orange-500"
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

    {/* 分类选择器浮层 */}
    {showCategorySelector && (
      <CategorySelector
        type={addType}
        onSelect={handleSelectCategory}
        onClose={() => setShowCategorySelector(false)}
      />
    )}

    {/* 月份选择弹窗 (ActionSheet) */}
    {showMonthPicker && (
      <>
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={() => setShowMonthPicker(false)} />
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#0a0a0a] rounded-t-[40px] z-50 p-6 pb-10 transition-transform duration-500 transform translate-y-0">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">选择月份</h3>
            <button onClick={() => setShowMonthPicker(false)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
              <X size={24} className="text-gray-500" />
            </button>
          </div>

          <div className="space-y-5">
            <div>
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-1">年份</label>
              <select
                value={tempYear}
                onChange={(e) => setTempYear(parseInt(e.target.value))}
                className="w-full bg-gray-100 dark:bg-gray-800 rounded-2xl py-3 px-4 text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-orange-500"
              >
                {yearOptions.map(year => (
                  <option key={year} value={year}>{year}年</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-1">月份</label>
              <select
                value={tempMonth + 1}
                onChange={(e) => setTempMonth(parseInt(e.target.value) - 1)}
                className="w-full bg-gray-100 dark:bg-gray-800 rounded-2xl py-3 px-4 text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-orange-500"
              >
                {monthOptions.map(month => (
                  <option key={month} value={month}>{month}月</option>
                ))}
              </select>
            </div>

            <button
              onClick={confirmMonth}
              className="w-full bg-[#ff8800] text-white font-black py-4 rounded-2xl mt-4 active:scale-[0.98] transition"
            >
              确认
            </button>
          </div>
        </div>
      </>
    )}
  </main>
);
}