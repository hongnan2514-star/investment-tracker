// app/ledger/account/[symbol]/page.tsx
"use client";

import { useParams, useRouter } from 'next/navigation';
import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, ChevronDown, Repeat, X, Trash2, } from 'lucide-react';
import { useCurrency } from '@/src/services/currency';
import { getCurrentUserId } from '@/src/utils/assetStorage';
import TransactionList from '@/components/TransactionList';
import { eventBus } from '@/src/utils/eventBus';
import { useTheme } from '@/app/ThemeProvider';

function formatLargeNumber(num: number): string {
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(2) + 'K';
  return num.toFixed(2);
}

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

interface AccountInfo {
  symbol: string;
  name: string;
  logoUrl?: string;
  marketValue: number;
  currency: string;
}

// 骨架屏组件
function AccountDetailSkeleton() {
  const skeletonBlockClass = "bg-gray-200 dark:bg-gray-700 rounded animate-pulse";
  return (
    <div className="min-h-screen bg-white dark:bg-black p-4">
      <div className="max-w-md mx-auto">
        {/* 头部返回按钮+logo占位 */}
        <div className="flex items-center justify-between mb-4">
          <div className={`w-8 h-8 rounded-full ${skeletonBlockClass}`} />
          <div className={`w-8 h-8 rounded-full ${skeletonBlockClass}`} />
        </div>
        {/* 时间选择器占位 */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex flex-col shrink-0 mt-3 ml-4">
            <div className={`h-4 w-12 ${skeletonBlockClass} mb-2`} />
            <div className={`h-8 w-16 ${skeletonBlockClass}`} />
          </div>
          <div className="w-px h-10 bg-gray-300 dark:bg-gray-600" />
          <div className={`h-8 w-28 ${skeletonBlockClass} -ml-1 mt-6`} />
        </div>
        {/* 统计卡片占位 */}
        <div className={`rounded-2xl p-4 mb-4 ${skeletonBlockClass} h-32`} />
        {/* 交易列表占位 */}
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className={`rounded-2xl p-3 ${skeletonBlockClass} h-20`} />
          ))}
        </div>
      </div>
    </div>
  );
}

const getIconPath = (logoUrl: string | undefined, theme: string) => {
  if (!logoUrl) return null;
  // 完整 URL（如 https://...）直接返回
  if (logoUrl.startsWith('http')) return logoUrl;

  // 提取文件名（去掉可能存在的路径前缀）
  let fileName = logoUrl.split('/').pop() || logoUrl;
  // 移除可能的查询参数
  fileName = fileName.split('?')[0];

  // 提取基础 key：去掉 _light/_dark 后缀和 .png 扩展名
  const key = fileName.replace(/_(light|dark)\.png$/, '').replace(/\.png$/, '');

  const suffix = theme === 'dark' ? 'dark' : 'light';
  return `/icons/payment/${key}_${suffix}.png`;
};

export default function AccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const symbol = params.symbol as string;
  const { symbol: currencySymbol, currency } = useCurrency();
  const { theme } = useTheme();

  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [showExpense, setShowExpense] = useState(true);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [tempYear, setTempYear] = useState(currentYear);
  const [tempMonth, setTempMonth] = useState(currentMonth);

  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const yearOptions = Array.from({ length: 201 }, (_, i) => currentYear - 100 + i);
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);

  const loadAccountInfo = async () => {
    const userId = getCurrentUserId();
    if (!userId) return;
    try {
      const res = await fetch('/api/asset', { headers: { 'x-user-id': userId } });
      if (res.ok) {
        const data = await res.json();
        const found = data.find((asset: any) => asset.symbol === symbol);
        if (found) {
          setAccount({
            symbol: found.symbol,
            name: found.name,
            logoUrl: found.logoUrl,
            marketValue: Number(found.marketValue) || 0,
            currency: found.currency || 'CNY',
          });
        } else {
          setAccount(null);
        }
      }
    } catch (err) {
      console.error('加载账户信息失败', err);
    }
  };

  const handleDeleteAccount = async () => {
  if (!account) return;
  const confirmed = window.confirm(`确定要删除账户“${account.name}”吗？\n此操作将同时删除该账户的所有交易记录，且不可撤销。`);
  if (!confirmed) return;

  const userId = getCurrentUserId();
  if (!userId) {
    alert('请先登录');
    return;
  }

  try {
    const res = await fetch('/api/asset', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
      },
      body: JSON.stringify({ symbol: account.symbol }),
    });

    if (res.ok) {
      eventBus.emit('assetsUpdated');
      router.push('/ledger'); // 删除成功后返回收支首页
    } else {
      const error = await res.json();
      alert(error.error || '删除失败，请稍后重试');
    }
  } catch (err) {
    console.error('删除账户失败', err);
    alert('删除失败，请检查网络');
  }
};

const loadTransactions = async () => {
  const userId = getCurrentUserId();
  if (!userId || !symbol) return;
  setLoading(true);
  try {
    // 1. 获取当前账户信息（需要最新的 marketValue）
    const assetRes = await fetch('/api/asset', {
      headers: { 'x-user-id': userId },
    });
    if (!assetRes.ok) throw new Error('获取账户余额失败');
    const assets = await assetRes.json();
    const currentAccount = assets.find((a: any) => a.symbol === symbol);
    const currentMarketValue = currentAccount ? Number(currentAccount.marketValue) : 0;

    // 2. 获取该账户的所有交易记录
    const txRes = await fetch(`/api/transaction?assetSymbol=${encodeURIComponent(symbol)}`, {
      headers: { 'x-user-id': userId },
    });
    if (!txRes.ok) throw new Error('加载交易记录失败');
    const rawTxs = await txRes.json();

    // 3. 按交易日期正序排列（从旧到新）
    const sortedAsc = [...rawTxs].sort(
      (a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
    );

    // 4. 从当前余额倒推每笔交易后的余额
    //    正序遍历，计算交易后的余额
    let runningBalance = currentMarketValue;
    // 为了从后向前填充，我们需要知道每笔交易对余额的影响方向
    // 买入（buy）增加资产，卖出（sell）减少资产
    // 但注意我们存储的 transaction_type: 'buy' 对应收入（增加余额），'sell' 对应支出（减少余额）
    // 然而在计算余额时，需要从当前余额倒推：对于每一笔交易，如果是收入，则交易前的余额 = 交易后余额 - 金额；如果是支出，则交易前的余额 = 交易后余额 + 金额
    // 因此我们正序遍历时，可以计算交易后的余额，但需要知道初始余额（当前余额减去所有交易的影响）
    // 更简单的方法：复制一份倒序数组，从当前余额开始累减/累加
    const reversed = [...sortedAsc].reverse();
    const enriched: Transaction[] = [];
    let balance = currentMarketValue;
    for (const tx of reversed) {
      const isIncome = tx.transaction_type === 'buy';
      const amount = Number(tx.price);
      // 当前这笔交易发生后的余额就是 balance
      const balanceAfter = balance;
      // 根据交易类型回退到交易前的余额
      if (isIncome) {
        balance = balance - amount;
      } else {
        balance = balance + amount;
      }
      enriched.push({
        id: tx.id.toString(),
        type: isIncome ? 'income' : 'expense',
        amount: amount,
        category: tx.category || '其他',
        note: tx.note || '',
        date: tx.transaction_date,
        accountSymbol: symbol,
        accountName: account?.name || '',
        accountLogoUrl: account?.logoUrl,
        accountBalanceAfter: balanceAfter,
      });
    }
    // 由于我们是从当前余额倒推，得到的 enriched 顺序是倒序（最新的在前），正合需求
    setTransactions(enriched);
  } catch (err) {
    console.error('加载交易记录失败', err);
    setTransactions([]);
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    if (symbol) loadAccountInfo();
  }, [symbol]);

  useEffect(() => {
    if (account) loadTransactions();
  }, [account]);

  useEffect(() => {
    const handleUpdate = () => {
      loadAccountInfo();
      loadTransactions();
    };
    const unsubscribe = eventBus.subscribe('assetsUpdated', handleUpdate);
    return () => unsubscribe();
  }, [symbol]);

  const currentMonthTransactions = transactions.filter(t => {
    const [year, month] = t.date.split('-');
    return parseInt(year) === currentYear && parseInt(month) === currentMonth + 1;
  });
  const totalIncome = currentMonthTransactions.reduce((sum, t) => t.type === 'income' ? sum + t.amount : sum, 0);
  const totalExpense = currentMonthTransactions.reduce((sum, t) => t.type === 'expense' ? sum + t.amount : sum, 0);
  const netBalance = totalIncome - totalExpense;

  const goBack = () => router.back();
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

  // 加载中状态
  if (loading) {
    return <AccountDetailSkeleton />;
  }

  if (!account && !loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-black p-4">
        <button onClick={goBack} className="flex items-center gap-2 text-blue-600 mb-4">
          <ArrowLeft size={20} /> 返回
        </button>
        <div className="text-center py-10">账户不存在</div>
      </div>
    );
  }

  const currentAmount = showExpense ? totalExpense : totalIncome;
  const currentLabel = showExpense ? '总支出' : '总收入';

return (
    <div className="min-h-screen bg-white dark:bg-black p-4">
      <div className="max-w-md mx-auto">
        {/* 头部区域 */}
<div className="flex items-center justify-between mb-4">
  <button onClick={goBack} className="text-gray-600 dark:text-gray-300">
    <ArrowLeft size={24} />
  </button>
  <div className="flex items-center gap-2">
    {account?.logoUrl ? (
      <img
        src={getIconPath(account.logoUrl, theme) || ''}
        alt={account.name}
        className="w-8 h-8 object-contain rounded-full"
        style={{ backgroundColor: 'transparent' }}
        onError={(e) => (e.currentTarget.style.display = 'none')}
      />
    ) : (
      <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
        <span className="text-lg font-bold text-gray-600">💰</span>
      </div>
    )}
    <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">{account?.name}</h1>
  </div>
  <button
    onClick={handleDeleteAccount}
    className="text-gray-500 dark:text-red-400 p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
    aria-label="删除账户"
  >
    <Trash2 size={20} />
  </button>
</div>

        {/* 第二行：时间选择器 + 竖线 + 余额 */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex flex-col shrink-0 mt-3 ml-4">
            <span className="text-sm text-gray-500 dark:text-gray-400">{currentYear}年</span>
            <div className="flex items-center mt-0.5">
              <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">{monthNames[currentMonth]}</span>
              <button onClick={openMonthPicker} className="ml-1 p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                <ChevronDown size={16} className="text-gray-500 dark:text-gray-400" />
              </button>
            </div>
          </div>

          <div className="w-px h-10 bg-gray-300 dark:bg-gray-600 mt-3 mx-0.5" />

          <div className="flex items-baseline gap-1 -ml-1 mt-6">
            <span className="text-4xl font-bold text-gray-900 dark:text-gray-100">
              {formatLargeNumber(account?.marketValue || 0)}
            </span>
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">{currency}</span>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="bg-white dark:bg-[#0a0a0a] rounded-2xl p-4 mb-4 shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 mb-2">
            <button onClick={() => setShowExpense(!showExpense)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors" title="切换查看收入/支出">
              <Repeat size={16} className="text-gray-500" />
            </button>
            <span className="text-sm text-gray-500 dark:text-gray-400">{currentLabel}</span>
          </div>
          <div className="flex items-baseline gap-1 text-gray-900 dark:text-gray-100 mb-4">
            <span className="text-3xl font-bold">{currentAmount.toFixed(2)}</span>
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">{currency}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-gray-500">月结余</div>
            <div className="flex items-baseline gap-0.5 text-xs font-bold text-gray-900 dark:text-gray-100">
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400">{currencySymbol}</span>
              <span>{netBalance.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* 交易记录列表 */}
        <TransactionList
          transactions={currentMonthTransactions}
          currencySymbol={currencySymbol}
          emptyMessage="本月暂无收支记录"
        />
      </div>

      {/* 月份选择弹窗 */}
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
    </div>
  );
}