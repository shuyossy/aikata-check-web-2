"use client";

import { Avatar, AvatarProps } from "./Avatar";
import { cn } from "@/lib/utils";

export interface AvatarGroupProps {
  /** メンバーリスト */
  members: { name: string }[];
  /** 表示する最大数（デフォルト: 4） */
  maxDisplay?: number;
  /** アバターサイズ */
  size?: AvatarProps["size"];
  /** カスタムクラス名 */
  className?: string;
}

/**
 * アバターグループコンポーネント
 * 複数のアバターを重ねて表示し、超過分は「+N」で表示
 */
export function AvatarGroup({
  members,
  maxDisplay = 4,
  size = "md",
  className,
}: AvatarGroupProps) {
  const displayMembers = members.slice(0, maxDisplay);
  const remainingCount = members.length - maxDisplay;

  const sizeClasses = {
    sm: "w-6 h-6 text-xs",
    md: "w-8 h-8 text-xs",
    lg: "w-10 h-10 text-sm",
  } as const;

  return (
    <div className={cn("flex -space-x-2", className)}>
      {displayMembers.map((member, index) => (
        <Avatar key={index} name={member.name} size={size} bordered />
      ))}
      {remainingCount > 0 && (
        <div
          className={cn(
            "rounded-full bg-gray-300 border-2 border-white flex items-center justify-center text-gray-600 font-medium flex-shrink-0",
            sizeClasses[size],
          )}
          title={`他 ${remainingCount} 名`}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
}
