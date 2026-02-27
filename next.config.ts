// next.config.ts
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

export default nextConfig;

