// components/AIChatBox.tsx
"use client";
import React, { useState } from 'react';
import { Send } from 'lucide-react';
import FullScreenChat from './FullScreenChat';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface AIChatBoxProps {
  userContext?: string;
}

export default function AIChatBox({ userContext }: AIChatBoxProps) {
  const [fullScreenOpen, setFullScreenOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  const handleOpenFullScreen = () => {
    setFullScreenOpen(true);
  };

  if (fullScreenOpen) {
    return (
      <FullScreenChat
        initialMessages={messages}
        userContext={userContext || ''}
        onClose={() => setFullScreenOpen(false)}
      />
    );
  }

  return (
    <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl p-4 shadow-md">
      {/* 消息预览区域 - 显示最近几条 */}
      {messages.length > 0 && (
        <div className="mb-2 max-h-20 overflow-y-auto space-y-1 text-sm">
          {messages.slice(-2).map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <span
                className={`inline-block max-w-[80%] px-2 py-1 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                }`}
              >
                {msg.content.length > 20 ? msg.content.slice(0, 20) + '…' : msg.content}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 点击输入条进入全屏 */}
      <div
        onClick={handleOpenFullScreen}
        className="flex items-center gap-2 cursor-text"
      >
        <div className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 px-4 py-3 rounded-full text-base">
          你可以问我投资问题...
        </div>
        <button className="bg-blue-600 text-white p-3 rounded-full">
          <Send size={20} />
        </button>
      </div>
    </div>
  );
}
