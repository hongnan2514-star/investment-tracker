// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/shared/BottomNav";
import { ThemeProvider } from "./ThemeProvider";
import SnapshotScheduler from "@/components/shared/SnapshotScheduler"; // 新增导入

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Investment Tracker",
  description: "多投资组合追踪器",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 dark:bg-gray-900 pb-20`}
      >
        <ThemeProvider>
          {children}
          <BottomNav />
          <SnapshotScheduler /> {/* 新增组件，放在底部 */}
        </ThemeProvider>
      </body>
    </html>
  );
}