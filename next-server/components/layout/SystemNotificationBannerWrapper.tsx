import { SystemNotificationRepository } from "@/infrastructure/adapter/db";
import { ListActiveNotificationsService } from "@/application/system-notification";
import { SystemNotificationBanner } from "./SystemNotificationBanner";
import { getLogger } from "@/lib/server/logger";

/**
 * システム通知バナーラッパー（サーバーコンポーネント）
 * RSCで通知を取得してクライアントコンポーネントに渡す
 */
export async function SystemNotificationBannerWrapper() {
  try {
    const repository = new SystemNotificationRepository();
    const service = new ListActiveNotificationsService(repository);
    const notifications = await service.execute();

    return <SystemNotificationBanner notifications={notifications} />;
  } catch (error) {
    // エラーが発生しても画面表示を妨げない
    const logger = getLogger();
    logger.error({ err: error }, "Failed to load system notifications");
    return null;
  }
}
