"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Save } from 'lucide-react';
import AvatarEditor from 'react-avatar-editor';

export default function EditProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [nickname, setNickname] = useState('');
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [scale, setScale] = useState(1.2);
  const editorRef = useRef<AvatarEditor>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const userData = JSON.parse(storedUser);
      setUser(userData);
      setNickname(userData.name || '');
      setAvatarBase64(userData.avatar || null);
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

  const handleCropConfirm = () => {
    if (editorRef.current && selectedImage) {
      const canvas = editorRef.current.getImageScaledToCanvas();
      const croppedBase64 = canvas.toDataURL('image/jpeg');
      setAvatarBase64(croppedBase64);
      setSelectedImage(null);
    }
  };

  const handleCropCancel = () => {
    setSelectedImage(null);
  };

  const handleSave = () => {
    if (!user) return;

    const updatedUser = {
      ...user,
      name: nickname.trim() || user.name,
      avatar: avatarBase64,
    };

    const phone = user.phone;
    if (phone) {
      localStorage.setItem(`user_${phone}`, JSON.stringify(updatedUser));
    }
    localStorage.setItem('user', JSON.stringify(updatedUser));
    router.back();
  };

  const getInitial = () => {
    if (!user) return '?';
    return (user.name || '?').charAt(0).toUpperCase();
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black p-4 flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">加载中...</p>
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
                className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition"
              >
                确认裁剪
              </button>
              <button
                onClick={handleCropCancel}
                className="flex-1 bg-gray-200 dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300 font-bold py-3 rounded-xl hover:bg-gray-300 dark:hover:bg-[#2a2a2a] transition"
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
                {avatarBase64 ? (
                  <img src={avatarBase64} alt="avatar" className="w-full h-full object-cover" />
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
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">点击头像上传照片</p>
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
              className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-blue-700 transition flex items-center justify-center gap-2"
            >
              <Save size={20} />
              保存修改
            </button>
          </>
        )}
      </div>
    </main>
  );
}