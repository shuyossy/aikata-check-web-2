import { SystemNotificationRepository } from "@/infrastructure/adapter/db";
import { ListSystemNotificationsService } from "@/application/system-notification";
import { NotificationsClient } from "./components/NotificationsClient";

// ビルド時のpre-renderingをスキップ（DBアクセスが必要なため）
export const dynamic = "force-dynamic";

/**
 * 通知設定管理ページ（サーバーコンポーネント）
 * RSCで初期データを取得してクライアントコンポーネントに渡す
 */
export default async function AdminNotificationsPage() {
  const repository = new SystemNotificationRepository();
  const service = new ListSystemNotificationsService(repository);
  const result = await service.execute({ offset: 0, limit: 100 });

  return <NotificationsClient initialNotifications={result.notifications} />;
}
