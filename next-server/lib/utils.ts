import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Tailwind CSSのクラス名をマージするユーティリティ
 * clsxで条件付きクラスを処理し、twMergeで重複を解消
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
