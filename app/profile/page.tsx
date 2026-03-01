// app/profile/page.tsx
"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, LogOut, Smartphone, Send, ChevronRight, Settings } from 'lucide-react';
import Image from 'next/image';
import { setCurrentUserId } from '@/src/utils/assetStorage';
import { eventBus } from '@/src/utils/eventBus';

export default function ProfilePage() {
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
  };

  const handleLogout = () => {
    setCurrentUserId(null);
    localStorage.removeItem('user');
    localStorage.removeItem('preferred_currency');
    setIsLoggedIn(false);
    setUser(null);
    eventBus.emit('userChanged', null);
  };

  const resetForm = () => {
    setOtpSent(false);
    setOtp('');
    setCountdown(0);
    setRegisterStep(false);
    setRegisterPassword('');
  };

  const renderLoginForm = () => {
    if (loginMethod === 'otp') {
      if (registerStep) {
        // 注册步骤：显示密码输入
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
                className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 ring-blue-500 mt-1 text-black dark:text-white font-medium"
              />
            </div>
            <button
              onClick={handleRegister}
              disabled={registerPassword.length < 6 || loading}
              className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-blue-700 transition disabled:bg-gray-300 dark:disabled:bg-gray-600 mt-4"
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
        // 验证码登录表单（原有逻辑）
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
                className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 ring-blue-500 mt-1 text-black dark:text-white font-medium disabled:bg-gray-100 dark:disabled:bg-[#2a2a2a] disabled:text-gray-700 dark:disabled:text-gray-400"
              />
            </div>

            {!otpSent && (
              <button
                onClick={handleSendOtp}
                disabled={!phoneNumber || phoneNumber.length !== 11 || loading}
                className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-blue-700 transition disabled:bg-gray-300 dark:disabled:bg-gray-600 flex items-center justify-center gap-2"
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
                      className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 ring-blue-500 text-black dark:text-white font-medium pr-24"
                      maxLength={6}
                      autoFocus
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      {countdown > 0 ? (
                        <span className="text-sm text-gray-400 dark:text-gray-500 whitespace-nowrap">{countdown}s</span>
                      ) : (
                        <button
                          onClick={handleSendOtp}
                          className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 whitespace-nowrap"
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
                  className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-blue-700 transition disabled:bg-gray-300 dark:disabled:bg-gray-600"
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
              className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 ring-blue-500 mt-1 text-black dark:text-white font-medium"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase ml-1">密码</label>
            <input
              type="password"
              placeholder="请输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 ring-blue-500 mt-1 text-black dark:text-white font-medium"
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => {
                setShowForgotPassword(true);
                setLoginMethod('otp');
              }}
              className="text-sm text-blue-600 dark:text-blue-400"
            >
              忘记密码？
            </button>
          </div>
          <button
            onClick={handlePasswordLogin}
            disabled={!phoneNumber || phoneNumber.length !== 11 || !password || loading}
            className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-blue-700 transition disabled:bg-gray-300 dark:disabled:bg-gray-600"
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
                className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 ring-blue-500 mt-1 text-black dark:text-white font-medium"
              />
            </div>
            <button
              onClick={handleForgotPassword}
              disabled={!phoneNumber || phoneNumber.length !== 11 || loading}
              className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-blue-700 transition disabled:bg-gray-300 dark:disabled:bg-gray-600"
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
                className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 ring-blue-500 mt-1 text-black dark:text-white font-medium"
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
                className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 ring-blue-500 mt-1 text-black dark:text-white font-medium"
              />
            </div>
            <button
              onClick={handleForgotPassword}
              disabled={resetOtp.length !== 6 || !resetPassword || loading}
              className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-blue-700 transition disabled:bg-gray-300 dark:disabled:bg-gray-600"
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

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-black p-4">
      <header className="mb-6 px-2 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">我的</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">管理您的个人信息</p>
        </div>
        <button
          id="settings-gear"
          onClick={() => router.push('/settings')}
          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition"
        >
          <Settings size={24} className="text-gray-600 dark:text-gray-300" />
        </button>
      </header>

      <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl p-6 shadow-md mb-4">
        {isLoggedIn ? (
          <>
            <div
              onClick={() => router.push('/profile/edit')}
              className="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-[#1a1a1a] rounded-xl -mx-2 p-2 transition"
            >
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {user?.avatarUrl ? (
                    <Image src={user.avatarUrl} alt={user.name} width={80} height={80} className="object-cover" />
                  ) : (
                    <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                      {user?.name?.charAt(0).toUpperCase() || '?'}
                    </span>
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{user?.name}</h2>
                  <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-sm mt-1">
                    <Smartphone size={14} />
                    <span>{user?.phone}</span>
                  </div>
                </div>
              </div>
              <ChevronRight size={24} className="text-gray-400 dark:text-gray-500" />
            </div>

            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 text-red-500 dark:text-red-400 font-bold py-3 rounded-2xl border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
              >
                <LogOut size={20} />
                退出登录
              </button>
            </div>
          </>
        ) : (
          <>
            {!showLoginForm && !showForgotPassword ? (
              <button
                onClick={() => setShowLoginForm(true)}
                className="w-full flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/30 rounded-2xl border border-blue-100 dark:border-blue-800"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                    <User size={20} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-blue-900 dark:text-blue-300">登录/注册</p>
                    <p className="text-xs text-blue-600/70 dark:text-blue-400/70 font-medium">使用手机号验证码或密码登录</p>
                  </div>
                </div>
                <ChevronRight className="text-blue-400 dark:text-blue-500" size={20} />
              </button>
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
                        ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                        : 'text-gray-400 dark:text-gray-500'
                    }`}
                    onClick={() => setLoginMethod('otp')}
                  >
                    验证码登录
                  </button>
                  <button
                    className={`flex-1 py-2 text-sm font-medium ${
                      loginMethod === 'password'
                        ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
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
          </>
        )}
      </div>
    </main>
  );
}