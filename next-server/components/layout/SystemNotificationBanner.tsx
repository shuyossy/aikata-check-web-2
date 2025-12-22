"use client";

import { useState, useEffect } from "react";
import { SystemNotificationDto } from "@/domain/system-notification";
import { AlertTriangle, ChevronLeft, ChevronRight, X } from "lucide-react";

interface SystemNotificationBannerProps {
  notifications: SystemNotificationDto[];
}

/**
 * システム通知バナーコンポーネント
 * 全画面で固定表示される通知バナー
 */
export function SystemNotificationBanner({
  notifications,
}: SystemNotificationBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDismissed, setIsDismissed] = useState(false);

  // 通知がない場合や閉じられた場合は表示しない
  if (notifications.length === 0 || isDismissed) {
    return null;
  }

  const currentNotification = notifications[currentIndex];
  const hasMultiple = notifications.length > 1;

  const goToPrevious = () => {
    setCurrentIndex((prev) =>
      prev === 0 ? notifications.length - 1 : prev - 1,
    );
  };

  const goToNext = () => {
    setCurrentIndex((prev) =>
      prev === notifications.length - 1 ? 0 : prev + 1,
    );
  };

  return (
    <div className="bg-amber-50 border-b border-amber-200 flex-shrink-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-2 gap-4">
          {/* 左側：アイコンと通知内容 */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <AlertTriangle className="size-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 max-h-24 overflow-y-auto">
              <p className="text-sm text-amber-800 whitespace-pre-wrap">
                {currentNotification.message}
              </p>
            </div>
          </div>

          {/* 右側：ページネーションと閉じるボタン */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {hasMultiple && (
              <div className="flex items-center gap-1">
                <button
                  onClick={goToPrevious}
                  className="p-1 text-amber-600 hover:text-amber-800 hover:bg-amber-100 rounded transition-colors"
                  aria-label="前の通知"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <span className="text-xs text-amber-700 min-w-[3rem] text-center">
                  {currentIndex + 1} / {notifications.length}
                </span>
                <button
                  onClick={goToNext}
                  className="p-1 text-amber-600 hover:text-amber-800 hover:bg-amber-100 rounded transition-colors"
                  aria-label="次の通知"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            )}
            <button
              onClick={() => setIsDismissed(true)}
              className="p-1 text-amber-600 hover:text-amber-800 hover:bg-amber-100 rounded transition-colors"
              aria-label="閉じる"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
