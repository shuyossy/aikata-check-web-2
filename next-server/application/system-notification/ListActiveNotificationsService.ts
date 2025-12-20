import { ISystemNotificationRepository } from "@/application/shared/port/repository";
import { SystemNotificationDto } from "@/domain/system-notification";

/**
 * アクティブな通知一覧取得サービス
 * 全画面共通の通知バナー表示に使用
 */
export class ListActiveNotificationsService {
  constructor(
    private readonly systemNotificationRepository: ISystemNotificationRepository,
  ) {}

  /**
   * アクティブなシステム通知一覧を取得する
   * @returns アクティブなシステム通知一覧（displayOrder順）
   */
  async execute(): Promise<SystemNotificationDto[]> {
    const notifications =
      await this.systemNotificationRepository.findActiveNotifications();

    return notifications.map((notification) => notification.toDto());
  }
}
