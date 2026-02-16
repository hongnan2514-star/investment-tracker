// components/FullScreenChat.tsx
"use client";
import React, { useState, useRef, useEffect } from 'react';
import { Send, X, ChevronDown, ChevronUp } from 'lucide-react';

// 扩展消息接口，支持推理内容
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning?: string; // 推理过程
}

interface StockInfo {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  currency: string;
}

interface FullScreenChatProps {
  initialMessages: Message[];
  userContext: string;
  onClose: () => void;
}

export default function FullScreenChat({ initialMessages, userContext, onClose }: FullScreenChatProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [stockInfo, setStockInfo] = useState<StockInfo | null>(null);
  const [userName, setUserName] = useState<string>('访客');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 流式状态：分别存储推理和答案
  const [reasoningStream, setReasoningStream] = useState('');
  const [answerStream, setAnswerStream] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);

  // 折叠状态：存储已折叠的推理消息的索引（用于已完成的消息）
  const [collapsedReasonings, setCollapsedReasonings] = useState<number[]>([]);
  // 流式推理折叠状态
  const [isReasoningStreamCollapsed, setIsReasoningStreamCollapsed] = useState(false);

  // 动画状态：控制滑入滑出
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        if (user.name) setUserName(user.name);
      }
    } catch (e) {
      console.error('读取用户信息失败', e);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, reasoningStream, answerStream]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const extractStockSymbol = (text: string): string | null => {
    const aShareMatch = text.match(/\b\d{6}\b/);
    if (aShareMatch) return aShareMatch[0];
    const usMatch = text.match(/\b[A-Z]{1,5}\b/);
    if (usMatch) return usMatch[0];
    const nameMap: Record<string, string> = {
      '茅台': '600519',
      '腾讯': '00700',
      '阿里巴巴': 'BABA',
      '苹果': 'AAPL',
      '特斯拉': 'TSLA',
    };
    for (const [name, symbol] of Object.entries(nameMap)) {
      if (text.includes(name)) return symbol;
    }
    return null;
  };

  const fetchStockInfo = async (symbol: string) => {
    try {
      const res = await fetch(`/api/search?symbol=${encodeURIComponent(symbol)}`);
      const data = await res.json();
      if (data && data.symbol) {
        setStockInfo({
          symbol: data.symbol,
          name: data.name,
          price: data.price || 0,
          changePercent: data.changePercent || 0,
          currency: data.currency || 'USD',
        });
      } else {
        setStockInfo(null);
      }
    } catch (error) {
      console.error('获取股票信息失败', error);
      setStockInfo(null);
    }
  };

  const handleSend = async (customMessage?: string) => {
    const messageToSend = customMessage !== undefined ? customMessage : input;
    if (!messageToSend.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: messageToSend };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    setReasoningStream('');
    setAnswerStream('');
    setIsReasoningStreamCollapsed(false);

    const symbol = extractStockSymbol(messageToSend);
    if (symbol) {
      await fetchStockInfo(symbol);
    }

    const apiMessages = userContext
      ? [{ role: 'system', content: userContext }, ...newMessages]
      : newMessages;

    try {
      abortControllerRef.current = new AbortController();
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;
      let finalReasoning = '';
      let finalAnswer = '';

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6);
              if (dataStr === '[DONE]') continue;
              try {
                const parsed = JSON.parse(dataStr);
                console.log('🔍 Received chunk:', parsed);
                const delta = parsed.choices[0]?.delta;
                if (delta) {
                  const reasoning = delta.reasoning || delta.reasoning_content || '';
                  const content = delta.content || '';
                  if (reasoning) {
                    finalReasoning += reasoning;
                    setReasoningStream(finalReasoning);
                  }
                  if (content) {
                    finalAnswer += content;
                    setAnswerStream(finalAnswer);
                  }
                }
              } catch (e) {
                console.warn('Failed to parse chunk', e);
              }
            }
          }
        }
      }

      if (finalAnswer) {
        setMessages(prev => [...prev, { role: 'assistant', content: finalAnswer, reasoning: finalReasoning }]);
      }
      setReasoningStream('');
      setAnswerStream('');
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Stream aborted');
      } else {
        console.error('Stream error', error);
        setMessages(prev => [...prev, { role: 'assistant', content: '网络错误，请重试。' }]);
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const hasHoldings = userContext && userContext.includes('持仓');
  const suggestionQuestions = hasHoldings
    ? [
        '今日收益分析',
        '哪些资产贡献最大',
        '我的投资组合风险如何',
        '近期市场热点对我有何影响',
      ]
    : [
        '茅台走势',
        '比特币价格',
        '美股今天表现',
        '哪些行业值得关注',
      ];

  const toggleReasoning = (msgIndex: number) => {
    setCollapsedReasonings(prev =>
      prev.includes(msgIndex)
        ? prev.filter(i => i !== msgIndex)
        : [...prev, msgIndex]
    );
  };

  return (
    <div
      className={`fixed inset-0 bg-white dark:bg-black z-50 flex flex-col transition-transform duration-300 ease-in-out transform ${
        isVisible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
        {stockInfo ? (
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-gray-900 dark:text-gray-100">{stockInfo.name}</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">{stockInfo.symbol}</span>
            </div>
            <div className="flex items-center gap-4 mt-1">
              <span className="text-2xl font-black text-gray-900 dark:text-gray-100">
                {stockInfo.currency === 'USD' ? '$' : '¥'}{stockInfo.price.toFixed(2)}
              </span>
              <span className={`text-base font-bold ${stockInfo.changePercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {stockInfo.changePercent >= 0 ? '+' : ''}{stockInfo.changePercent.toFixed(2)}%
              </span>
            </div>
          </div>
        ) : (
          <div className="flex-1" />
        )}
        <button
          onClick={handleClose}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition"
        >
          <X size={24} className="text-gray-600 dark:text-gray-300" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => {
          const isReasoningCollapsed = collapsedReasonings.includes(idx);
          return (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && msg.reasoning ? (
                <div className="max-w-[95%] space-y-2">
                  {msg.reasoning && (
                    <div className="relative px-4 py-2 italic text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-semibold">🤔 思考过程</span>
                        <button
                          onClick={() => toggleReasoning(idx)}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded transition"
                        >
                          {isReasoningCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                        </button>
                      </div>
                      {!isReasoningCollapsed && <div>{msg.reasoning}</div>}
                    </div>
                  )}
                  <div className="px-4 py-3 text-gray-900 dark:text-gray-100 text-lg font-medium whitespace-pre-wrap">
                    {msg.content}
                  </div>
                </div>
              ) : msg.role === 'user' ? (
                <div className="max-w-[80%] px-4 py-2 rounded-2xl bg-blue-500 text-white">
                  {msg.content}
                </div>
              ) : (
                <div className="max-w-[95%] px-4 py-2 text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                  {msg.content}
                </div>
              )}
            </div>
          );
        })}

        {reasoningStream && (
          <div className="flex justify-start">
            <div className="max-w-[95%] px-4 py-2 italic text-sm text-gray-600 dark:text-gray-400">
              <div className="flex justify-between items-center mb-1">
                <span className="font-semibold">🤔 思考中...</span>
                <button
                  onClick={() => setIsReasoningStreamCollapsed(!isReasoningStreamCollapsed)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded transition"
                >
                  {isReasoningStreamCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </button>
              </div>
              {!isReasoningStreamCollapsed && <div>{reasoningStream}</div>}
            </div>
          </div>
        )}

        {answerStream && (
          <div className="flex justify-start">
            <div className="max-w-[95%] px-4 py-3 text-gray-900 dark:text-gray-100 text-lg font-medium whitespace-pre-wrap">
              {answerStream}
            </div>
          </div>
        )}

        {loading && !reasoningStream && !answerStream && (
          <div className="flex justify-start">
            <div className="text-gray-400 px-4 py-2">
              AI 正在思考...
            </div>
          </div>
        )}

        {messages.length === 0 && !reasoningStream && !answerStream && !loading && (
          <div className="h-full flex flex-col items-center justify-center -mt-16">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-8 text-center">
              Hi {userName},有什么需要我做的？
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md w-full">
              {suggestionQuestions.map((question, index) => (
                <button
                  key={index}
                  onClick={() => handleSend(question)}
                  className="px-4 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl text-gray-900 dark:text-gray-200 text-sm font-medium transition"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 底部输入条 */}
      <div className="border-t border-gray-200 dark:border-gray-800 p-4">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="你可以问我投资问题..."
            className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-200 px-4 py-3 rounded-full text-base outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:shadow-[0_0_10px_rgba(255,0,0,0.7),0_0_20px_rgba(0,255,0,0.5),0_0_30px_rgba(0,0,255,0.3)] transition-shadow duration-200"
            disabled={loading}
          />
          <button
            onClick={() => handleSend()}
            disabled={loading}
            className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}