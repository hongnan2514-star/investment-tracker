import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
        port: '',
        pathname: '/**',  // 允许所有路径
      },
      // 如果将来需要添加其他图片域名，继续在此数组追加
      // {
      //   protocol: 'https',
      //   hostname: 'another-cdn.com',
      // }
    ],
  },
};

export default withPWA({
  dest: 'public', // 指定生成的 Service Worker 文件存放位置
  disable: process.env.NODE_ENV === 'development', // 开发环境下禁用 PWA，避免缓存干扰
  register: true, // 自动注册 Service Worker
  skipWaiting: true, // 安装后立即激活新的 Service Worker
})(nextConfig);

export default nextConfig;

