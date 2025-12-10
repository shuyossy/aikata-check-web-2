"use client";

import { cn } from "@/lib/utils";

/**
 * アバターの背景色リスト（名前から色を決定するために使用）
 */
const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-red-500",
  "bg-indigo-500",
  "bg-teal-500",
  "bg-cyan-500",
  "bg-amber-500",
] as const;

/**
 * 文字列からハッシュ値を生成
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * 名前から色を決定
 */
function getColorFromName(name: string): string {
  const hash = hashString(name);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/**
 * 名前の先頭1文字を取得
 */
function getInitial(name: string): string {
  if (!name) return "?";
  return name.charAt(0);
}

export interface AvatarProps {
  /** 表示名 */
  name: string;
  /** サイズ */
  size?: "sm" | "md" | "lg";
  /** ボーダー表示 */
  bordered?: boolean;
  /** カスタムクラス名 */
  className?: string;
}

const sizeClasses = {
  sm: "w-6 h-6 text-xs",
  md: "w-8 h-8 text-sm",
  lg: "w-10 h-10 text-sm",
} as const;

/**
 * ユーザーアバターコンポーネント
 * 名前の先頭文字を表示し、名前からユニークな背景色を生成
 */
export function Avatar({
  name,
  size = "md",
  bordered = false,
  className,
}: AvatarProps) {
  const bgColor = getColorFromName(name);
  const initial = getInitial(name);

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center text-white font-medium flex-shrink-0",
        bgColor,
        sizeClasses[size],
        bordered && "border-2 border-white",
        className,
      )}
      title={name}
    >
      {initial}
    </div>
  );
}
