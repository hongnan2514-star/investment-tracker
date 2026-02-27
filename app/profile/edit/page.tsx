// app/profile/edit/page.tsx
"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Save, Loader2 } from 'lucide-react';
import AvatarEditor from 'react-avatar-editor';

export default function EditProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [nickname, setNickname] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);      // 最终展示的头像 URL
  const [selectedImage, setSelectedImage] = useState<string | null>(null); // 待裁剪的图片
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(false);
  const editorRef = useRef<AvatarEditor>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const userData = JSON.parse(storedUser);
      setUser(userData);
      setNickname(userData.name || '');
      setAvatarUrl(userData.avatarUrl || null);  // 注意字段名 avatarUrl（与后端一致）
    } else {
      router.push('/profile');
    }
  }, [router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('图片大小不能超过5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedImage(event.target?.result as string);
      setScale(1.2);
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleCropConfirm = async () => {
    if (!editorRef.current || !selectedImage || !user) return;

    // 从 canvas 获取裁剪后的 Blob
    const canvas = editorRef.current.getImageScaledToCanvas();
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob(resolve as any, 'image/jpeg'));
    const formData = new FormData();
    formData.append('avatar', blob, 'avatar.jpg');
    formData.append('userId', user.phone);

    setLoading(true);
    try {
      const res = await fetch('/api/user/avatar', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.avatarUrl) {
        setAvatarUrl(data.avatarUrl);    // 更新预览
        setSelectedImage(null);           // 退出裁剪模式
      } else {
        alert('头像上传失败');
      }
    } catch (error) {
      console.error('上传出错:', error);
      alert('网络错误');
    } finally {
      setLoading(false);
    }
  };

  const handleCropCancel = () => {
    setSelectedImage(null);
  };

  const handleSave = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // 调用个人信息更新接口
      const res = await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: user.phone,
          name: nickname.trim() || user.name,
          avatarUrl: avatarUrl,          // 如果有新头像 URL 就传过去
        }),
      });
      const data = await res.json();
      if (data.success) {
        // 更新本地存储
        const updatedUser = {
          ...user,
          name: data.user.name,
          avatarUrl: data.user.avatarUrl,
        };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        // 触发用户变更事件（其他组件可监听更新）
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('user-changed'));
        }
        router.back();
      } else {
        alert(data.error || '保存失败');
      }
    } catch (error) {
      console.error('保存出错:', error);
      alert('网络错误');
    } finally {
      setLoading(false);
    }
  };

  const getInitial = () => {
    if (!user) return '?';
    return (user.name || '?').charAt(0).toUpperCase();
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black p-4 flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">加载中...</p >
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-black p-4">
      <header className="mb-6 flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-200 dark:hover:bg-[#1a1a1a] rounded-full transition"
        >
          <ChevronLeft size={24} className="text-gray-600 dark:text-gray-300" />
        </button>
        <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">编辑资料</h1>
      </header>

      <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl p-6 shadow-md space-y-6">
        {loading && (
          <div className="absolute inset-0 bg-white/50 dark:bg-black/50 flex items-center justify-center z-10 rounded-3xl">
            <Loader2 className="animate-spin text-blue-600" size={40} />
          </div>
        )}

        {selectedImage ? (
          // 裁剪模式
          <div className="space-y-4">
            <div className="flex justify-center">
              <AvatarEditor
                ref={editorRef}
                image={selectedImage}
                width={250}
                height={250}
                border={10}
                borderRadius={125}
                color={[0, 0, 0, 0.6]}
                scale={scale}
                rotate={0}
              />
            </div>

            <div className="flex items-center gap-2 px-4">
              <span className="text-xs text-gray-500 dark:text-gray-400">缩小</span>
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                className="flex-1 accent-blue-600"
              />
              <span className="text-xs text-gray-500 dark:text-gray-400">放大</span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCropConfirm}
                disabled={loading}
                className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
              >
                {loading ? '上传中...' : '确认裁剪'}
              </button>
              <button
                onClick={handleCropCancel}
                disabled={loading}
                className="flex-1 bg-gray-200 dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300 font-bold py-3 rounded-xl hover:bg-gray-300 dark:hover:bg-[#2a2a2a] transition disabled:opacity-50"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          // 普通显示模式
          <>
            <div className="flex flex-col items-center">
              <div
                onClick={handleAvatarClick}
                className="relative w-24 h-24 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center overflow-hidden cursor-pointer group border-2 border-transparent hover:border-blue-400 transition"
              >
                {avatarUrl ? (
                  < img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl font-bold text-blue-600 dark:text-blue-400">{getInitial()}</span>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold">
                  更换
                </div>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">点击头像上传照片</p >
            </div>

            <div>
              <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase ml-1">昵称</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="请输入昵称"
                className="w-full bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-2xl border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 ring-blue-500 mt-1 text-black dark:text-white font-medium placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={loading}
              className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
              保存修改
            </button>
          </>
        )}
      </div>
    </main>
  );
}