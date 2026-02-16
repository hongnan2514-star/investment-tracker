// app/manifest.ts
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Investment Tracker', // 应用全名
    short_name: 'Tracker',      // 主屏幕显示简称
    description: '多投资组合追踪器',
    start_url: '/',             // 启动时的起始页面
    display: 'standalone',       // 👈 关键！设置为 'standalone' 可以全屏运行，隐藏浏览器地址栏 [citation:1][citation:7]
    background_color: '#000000', // 启动画面背景色
    theme_color: '#000000',      // 工具栏主题色 [citation:6]
    icons: [
      {
        src: '/icon-192x192.png', // 需要你准备一个 192x192 的图标
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512x512.png', // 需要你准备一个 512x512 的图标
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}