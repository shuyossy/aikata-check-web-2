import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { Toaster } from "@/components/ui/sonner";
import { SystemNotificationBannerWrapper } from "@/components/layout/SystemNotificationBannerWrapper";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AIKATA",
  description: "AIレビュープラットフォーム",
};

/**
 * ルートレイアウト
 * 認証プロバイダのみを提供し、レイアウト構造は各Route Groupで定義
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-screen flex flex-col overflow-hidden`}
      >
        <AuthProvider>
          <SystemNotificationBannerWrapper />
          <div className="flex-1 overflow-hidden">{children}</div>
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
