import { ReactNode } from "react";

interface FormSectionProps {
  /** セクション番号 */
  sectionNumber: number;
  /** セクションタイトル */
  title: string;
  /** 子要素 */
  children: ReactNode;
  /** タイトルの右側に表示するアイコン等 */
  titleIcon?: ReactNode;
  /** 追加のクラス名 */
  className?: string;
}

/**
 * フォームセクションコンポーネント
 * 番号付きのセクションヘッダーとコンテンツをレンダリング
 */
export function FormSection({
  sectionNumber,
  title,
  children,
  titleIcon,
  className = "",
}: FormSectionProps) {
  return (
    <div className={`mb-8 ${className}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
          {sectionNumber}
        </div>
        <h4 className="text-lg font-semibold text-gray-900">{title}</h4>
        {titleIcon}
      </div>
      <div className="ml-11">{children}</div>
    </div>
  );
}
