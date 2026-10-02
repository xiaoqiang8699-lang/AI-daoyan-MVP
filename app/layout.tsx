import type { Metadata } from "next";
import { AppChrome } from "@/components/app-chrome";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "AI 导演 · 一步一步，拍出喜欢的视频", template: "%s · AI 导演" },
  description: "把你喜欢的参考视频，变成一步一步可以拍出来的拍摄方案。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="font-sans antialiased"><AppChrome>{children}</AppChrome></body>
    </html>
  );
}
