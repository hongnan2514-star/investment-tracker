// components/dashboard/ProfileDrawer.tsx
"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, Smartphone, Send, BadgeCheck,} from 'lucide-react';
import { ImInfo } from "react-icons/im";
import { IoIosSettings } from "react-icons/io";

import Image from 'next/image';
import { setCurrentUserId } from '@/src/utils/assetStorage';
import { eventBus } from '@/src/utils/eventBus';
import { AiFillRedditCircle, AiOutlineX } from "react-icons/ai";

interface ProfileDrawerProps { 
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileDrawer({ isOpen, onClose }: ProfileDrawerProps) {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);

  const [loginMethod, setLoginMethod] = useState<'otp' | 'password'>('otp');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetOtp, setResetOtp] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetStep, setResetStep] = useState<'phone' | 'otp'>('phone');
  const [resetCountdown, setResetCountdown] = useState(0);
  const [registerStep, setRegisterStep] = useState(false);
  const [registerPassword, setRegisterPassword] = useState('');
  const [assetsCount, setAssetsCount] = useState<number>(0); // 新增持仓数量状态

  // 加载用户信息
  useEffect(() => {
    const loadUser = () => {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
        setIsLoggedIn(true);
      } else {
        setUser(null);
        setIsLoggedIn(false);
      }
    };
    loadUser();
    const handleUserChange = () => loadUser();
    window.addEventListener('user-changed', handleUserChange);
    return () => window.removeEventListener('user-changed', handleUserChange);
  }, []);

  // 发送验证码
  const handleSendOtp = async () => {
    if (!phoneNumber || phoneNumber.length !== 11) return;
    setLoading(true);
    setCountdown(60);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) clearInterval(timer);
        return prev - 1;
      });
    }, 1000);

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      });
      const data = await res.json();
      if (data.success) {
        setOtpSent(true);
      } else {
        alert(data.message || '发送失败');
      }
    } catch (error) {
      alert('网络错误');
    } finally {
      setLoading(false);
    }
  };

  // 验证验证码
  const handleVerifyOtp = async () => {
    if (otp.length !== 6) return;
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, otp }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.exists) {
          alert('该手机号已注册，请使用密码登录');
          setLoginMethod('password');
          setOtpSent(false);
          setOtp('');
          setPhoneNumber(data.user.phone);
        } else {
          setRegisterStep(true);
        }
      } else {
        alert(data.message || '验证码错误');
      }
    } catch (error) {
      alert('网络错误');
    } finally {
      setLoading(false);
    }
  };

  // 注册
  const handleRegister = async () => {
    if (registerPassword.length < 6) {
      alert('密码至少6位');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, password: registerPassword }),
      });
      const data = await res.json();
      if (data.success) {
        loginUser(data.user);
      } else {
        alert(data.message || '注册失败');
      }
    } catch (error) {
      alert('网络错误');
    } finally {
      setLoading(false);
    }
  };

  // 密码登录
  const handlePasswordLogin = async () => {
    if (!phoneNumber || phoneNumber.length !== 11 || !password) return;
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNumber, password }),
      });
      const data = await res.json();
      if (data.success) {
        loginUser(data.user);
      } else {
        alert(data.message || '登录失败');
      }
    } catch (error) {
      alert('网络错误');
    } finally {
      setLoading(false);
    }
  };

  // 忘记密码
  const handleForgotPassword = async () => {
    if (resetStep === 'phone') {
      if (!phoneNumber || phoneNumber.length !== 11) return;
      setLoading(true);
      setResetCountdown(60);
      const timer = setInterval(() => {
        setResetCountdown((prev) => {
          if (prev <= 1) clearInterval(timer);
          return prev - 1;
        });
      }, 1000);
      try {
        const res = await fetch('/api/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber }),
        });
        const data = await res.json();
        if (data.success) {
          setResetStep('otp');
        } else {
          alert(data.message || '发送失败');
        }
      } catch (error) {
        alert('网络错误');
      } finally {
        setLoading(false);
      }
    } else {
      if (resetOtp.length !== 6 || !resetPassword) return;
      setLoading(true);
      try {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: phoneNumber, otp: resetOtp, newPassword: resetPassword }),
        });
        const data = await res.json();
        if (data.success) {
          alert('密码重置成功，请使用新密码登录');
          setShowForgotPassword(false);
          setResetStep('phone');
          setResetOtp('');
          setResetPassword('');
          setPhoneNumber('');
          setLoginMethod('password');
        } else {
          alert(data.message || '重置失败');
        }
      } catch (error) {
        alert('网络错误');
      } finally {
        setLoading(false);
      }
    }
  };

  // 登录成功后处理
  const loginUser = (userInfo: any) => {
    setCurrentUserId(phoneNumber);
    setUser(userInfo);
    setIsLoggedIn(true);
    localStorage.setItem('user', JSON.stringify(userInfo));
    localStorage.setItem('preferred_currency', userInfo.preferredCurrency || 'USD');
    eventBus.emit('userChanged', phoneNumber);
    setShowLoginForm(false);
    setPhoneNumber('');
    setPassword('');
    setOtp('');
    setOtpSent(false);
    setRegisterStep(false);
    setRegisterPassword('');
    onClose();
  };

  const resetForm = () => {
    setOtpSent(false);
    setOtp('');
    setCountdown(0);
    setRegisterStep(false);
    setRegisterPassword('');
  };

  // 渲染登录表单（与原ProfilePage完全一致）
  const renderLoginForm = () => {
    if (loginMethod === 'otp') {
      if (registerStep) {
        return (
          <>
            <div className="mb-4">
              <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase ml-1">手机号</label>
              <input
                type="text"
                value={phoneNumber}
                disabled
                className="w-full bg-gray-100 dark:bg-[#2a2a2a] p-4 rounded-2xl border border-gray-200 dark:border-gray-700 mt-1 text-black dark:text-white font-medium"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase ml-1">设置密码</label>
              <input
                type="password"
                placeholder="至少6位"
                value={registerPassword}
                onChange={(e) => setRegisterPassword(e.target.value)}
                className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl border border-gray-200 dark:border-gray-700 outline-none mt-1 text-black dark:text-white font-medium"
              />
            </div>
            <button
              onClick={handleRegister}
              disabled={registerPassword.length < 6 || loading}
              className="w-full bg-[#ff8800] text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-[#ff8800] transition disabled:bg-gray-300 dark:disabled:bg-gray-600 mt-4"
            >
              {loading ? '注册中...' : '完成注册'}
            </button>
            <div className="text-center mt-2">
              <button
                onClick={() => {
                  setRegisterStep(false);
                  setOtpSent(false);
                  setOtp('');
                  setRegisterPassword('');
                }}
                className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                返回
              </button>
            </div>
          </>
        );
      } else {
        return (
          <>
            <div>
              <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase ml-1">手机号</label>
              <input
                type="tel"
                placeholder="请输入手机号"
                value={phoneNumber}
                onChange={(e) => {
                  if (!otpSent) {
                    setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 11));
                  }
                }}
                disabled={otpSent}
                className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl border border-gray-200 dark:border-gray-700 outline-none mt-1 text-black dark:text-white font-medium disabled:bg-gray-100 dark:disabled:bg-[#2a2a2a] disabled:text-gray-700 dark:disabled:text-gray-400"
              />
            </div>

            {!otpSent && (
              <button
                onClick={handleSendOtp}
                disabled={!phoneNumber || phoneNumber.length !== 11 || loading}
                className="w-full bg-[#ff8800] text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-[#ff8800] transition disabled:bg-gray-300 dark:disabled:bg-gray-600 flex items-center justify-center gap-2"
              >
                {loading ? '发送中...' : (
                  <>
                    <Send size={18} />
                    获取验证码
                  </>
                )}
              </button>
            )}

            {otpSent && (
              <>
                <div className="-mt-4">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="请输入验证码"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl border border-gray-200 dark:border-gray-700 outline-none text-black dark:text-white font-medium pr-24"
                      maxLength={6}
                      autoFocus
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      {countdown > 0 ? (
                        <span className="text-sm text-gray-400 dark:text-gray-500 whitespace-nowrap">{countdown}s</span>
                      ) : (
                        <button
                          onClick={handleSendOtp}
                          className="text-sm font-bold text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 whitespace-nowrap"
                        >
                          重发
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleVerifyOtp}
                  disabled={otp.length !== 6 || loading}
                  className="w-full bg-orange-600 text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-orange-700 transition disabled:bg-gray-300 dark:disabled:bg-gray-600"
                >
                  {loading ? '验证中...' : '下一步'}
                </button>

                <div className="text-center mt-2">
                  <button
                    onClick={resetForm}
                    className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    换手机号
                  </button>
                </div>
              </>
            )}
          </>
        );
      }
    } else {
      // 密码登录表单
      return (
        <>
          <div>
            <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase ml-1">手机号</label>
            <input
              type="tel"
              placeholder="请输入手机号"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
              className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl border border-gray-200 dark:border-gray-700 outline-none mt-1 text-black dark:text-white font-medium"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase ml-1">密码</label>
            <input
              type="password"
              placeholder="请输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl border border-gray-200 dark:border-gray-700 outline-none mt-1 text-black dark:text-white font-medium"
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => {
                setShowForgotPassword(true);
                setLoginMethod('otp');
              }}
              className="text-sm text-[#ff8800] dark:text-orange-400"
            >
              忘记密码？
            </button>
          </div>
          <button
            onClick={handlePasswordLogin}
            disabled={!phoneNumber || phoneNumber.length !== 11 || !password || loading}
            className="w-full bg-[#ff8800] text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-orange-700 transition disabled:bg-gray-300 dark:disabled:bg-gray-600"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </>
      );
    }
  };

  const renderForgotPassword = () => {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">重置密码</h3>
        {resetStep === 'phone' ? (
          <>
            <div>
              <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase ml-1">手机号</label>
              <input
                type="tel"
                placeholder="请输入手机号"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
                className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl border border-gray-200 dark:border-gray-700 outline-none mt-1 text-black dark:text-white font-medium"
              />
            </div>
            <button
              onClick={handleForgotPassword}
              disabled={!phoneNumber || phoneNumber.length !== 11 || loading}
              className="w-full bg-orange-600 text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-orange-700 transition disabled:bg-gray-300 dark:disabled:bg-gray-600"
            >
              {loading ? '发送中...' : '发送验证码'}
            </button>
          </>
        ) : (
          <>
            <div>
              <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase ml-1">验证码</label>
              <input
                type="text"
                placeholder="请输入验证码"
                value={resetOtp}
                onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl border border-gray-200 dark:border-gray-700 outline-none mt-1 text-black dark:text-white font-medium"
                maxLength={6}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase ml-1">新密码</label>
              <input
                type="password"
                placeholder="至少6位"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl border border-gray-200 dark:border-gray-700 outline-none mt-1 text-black dark:text-white font-medium"
              />
            </div>
            <button
              onClick={handleForgotPassword}
              disabled={resetOtp.length !== 6 || !resetPassword || loading}
              className="w-full bg-orange-600 text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-orange-700 transition disabled:bg-gray-300 dark:disabled:bg-gray-600"
            >
              {loading ? '重置中...' : '确认重置'}
            </button>
          </>
        )}
        <div className="text-center mt-2">
          <button
            onClick={() => {
              setShowForgotPassword(false);
              setResetStep('phone');
              setResetOtp('');
              setResetPassword(''); 
              setPhoneNumber('');
            }}
            className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          >
            返回登录
          </button>
        </div>
      </div>
    );
  };

// 公共按钮组件
  const ActionButtons = () => (
    <div className="mt-0 pt-6 border-t border-gray-100 dark:border-gray-700">
      <button onClick={() => { router.push('/subscription'); onClose(); }} className="w-full flex items-center gap-3 text-gray-900 dark:text-gray-100 font-bold py-3 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition px-4">
        <BadgeCheck size={26} className="text-gray-500 dark:text-gray-400 flex-shrink-0" />
        <span>订阅</span>
      </button>
      <button onClick={() => { router.push('/settings'); onClose(); }} className="w-full flex items-center gap-2 text-gray-900 dark:text-gray-100 font-bold py-3 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition px-4 mt-2">
        <IoIosSettings size={30} className="relative -left-[3px] text-gray-500 dark:text-gray-400 flex-shrink-0" />
        <span>设置与隐私</span>
      </button>
      <button onClick={() => { alert('投资追踪 v1.0.0'); onClose(); }} className="w-full flex items-center gap-3 text-gray-900 dark:text-gray-100 font-bold py-3 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition px-4 mt-2">
        <ImInfo size={26} className="text-gray-500 dark:text-gray-400 flex-shrink-0" />
        <span>关于我们</span>
      </button>
      <button onClick={() => { window.open('https://www.reddit.com/r/investment', '_blank'); onClose(); }} className="w-full flex items-center gap-3 text-gray-900 dark:text-gray-100 font-bold py-3 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition px-4 mt-2">
        <AiFillRedditCircle size={26} className="text-black dark:text-white flex-shrink-0" />
        <span>Reddit</span>
      </button>
      <button onClick={() => { window.open('https://twitter.com/investment', '_blank'); onClose(); }} className="w-full flex items-center gap-3 text-gray-900 dark:text-gray-100 font-bold py-3 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition px-4 mt-2">
        <AiOutlineX size={26} className="text-black dark:text-white flex-shrink-0" />
        <span>X</span>
      </button>
    </div>
  );

  // 加载资产数量（不计负债）
  const loadAssetsCount = async () => {
    const userId = localStorage.getItem('currentUserId');
    if (!userId) {
      setAssetsCount(0);
      return;
    }
    try {
      const res = await fetch('/api/asset', {
        headers: { 'x-user-id': userId },
      });
      if (res.ok) {
        const data = await res.json();
        // 过滤掉负债类型（liability）
        const nonLiabilityAssets = data.filter((asset: any) => asset.type !== 'liability');
        setAssetsCount(nonLiabilityAssets.length);
      } else {
        setAssetsCount(0);
      }
    } catch (err) {
      console.error('加载资产数量失败', err);
      setAssetsCount(0);
    }
  };

  // 监听资产更新事件，刷新持仓数量
  useEffect(() => {
    if (isLoggedIn) {
      loadAssetsCount();
      const unsubscribe = eventBus.subscribe('assetsUpdated', () => loadAssetsCount());
      return () => unsubscribe();
    }
  }, [isLoggedIn]);

  return (
    <div className="fixed inset-0 z-50" style={{ visibility: isOpen ? 'visible' : 'hidden' }}>
      {/* 遮罩层 */}
      <div className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      {/* 抽屉内容 */}
      <div className={`absolute right-0 top-0 h-full w-5/6 bg-white dark:bg-black shadow-xl transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex flex-col h-full overflow-y-auto">
          <div className="flex-1 p-4 pt-8">
{isLoggedIn ? (
  <>
    <div onClick={() => { router.push('/profile/edit'); onClose(); }} className="flex flex-col items-start cursor-pointer hover:bg-gray-50 dark:hover:bg-[#1a1a1a] rounded-xl -mx-2 p-4 transition">
      <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center overflow-hidden flex-shrink-0">
        {user?.avatarUrl ? <Image src={user.avatarUrl} alt={user.name} width={48} height={48} className="object-cover" /> : <span className="text-xl font-bold text-orange-600 dark:text-orange-400">{user?.name?.charAt(0).toUpperCase() || '?'}</span>}
      </div>
      <div className="mt-3">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{user?.name}</h2>
        <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-sm mt-1">
          <Smartphone size={14} />
          <span>{user?.phone}</span>
        </div>
        {/* 持仓：上下布局 */}
        <div className="flex flex-col items-center mt-4 -ml-16">
          <span className="text-lg font-bold text-gray-700 dark:text-gray-400">持仓</span>
          <span className="text-3sm font-medium text-gray-900 dark:text-gray-100">{assetsCount}</span>
        </div>
      </div>
    </div>
    <ActionButtons />
  </>
) : (
              <>
                {/* 未登录状态卡片 */}
                {!showLoginForm && !showForgotPassword ? (
                  <div
                    onClick={() => setShowLoginForm(true)}
                    className="flex flex-col items-start cursor-pointer hover:bg-gray-50 dark:hover:bg-[#1a1a1a] rounded-xl -mx-2 p-4 transition"
                  >
                    <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                      <User size={28} className="text-gray-500 dark:text-gray-400" />
                    </div>
                    <div className="mt-3">
                      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">未登录</h2>
                      <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-sm mt-1 invisible">
                        <Smartphone size={14} />
                        <span>00000000000</span>
                      </div>
                      <div className="flex flex-col items-center mt-4 -ml-16">
                        <span className="text-lg font-bold text-gray-700 dark:text-gray-400">持仓</span>
                        <span className="text-3sm font-medium text-gray-900 dark:text-gray-100">0</span>
                      </div>
                    </div>
                  </div>
                ) : showForgotPassword ? (
                  renderForgotPassword()
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">手机号登录</h3>
                      <button
                        onClick={() => {
                          setShowLoginForm(false);
                          resetForm();
                          setPhoneNumber('');
                          setPassword('');
                        }}
                        className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        取消
                      </button>
                    </div>
                    <div className="flex border-b border-gray-200 dark:border-gray-700">
                      <button
                        className={`flex-1 py-2 text-sm font-medium ${
                          loginMethod === 'otp'
                            ? 'text-[#ff8800] dark:text-[#ff8800] border-b-2 border-[#ff8800] dark:border-orange-400'
                            : 'text-gray-400 dark:text-gray-500'
                        }`}
                        onClick={() => setLoginMethod('otp')}
                      >
                        验证码登录
                      </button>
                      <button
                        className={`flex-1 py-2 text-sm font-medium ${
                          loginMethod === 'password'
                            ? 'text-[#ff8800] dark:text-[#ff8800] border-b-2 border-orange-600 dark:border-orange-400'
                            : 'text-gray-400 dark:text-gray-500'
                        }`}
                        onClick={() => setLoginMethod('password')}
                      >
                        密码登录
                      </button>
                    </div>
                    {renderLoginForm()}
                  </div>
                )}
                <ActionButtons />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}