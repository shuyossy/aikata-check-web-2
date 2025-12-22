import { ISystemNotificationRepository } from "@/application/shared/port/repository";
import {
  SystemNotificationId,
  SystemNotificationDto,
} from "@/domain/system-notification";
import { domainValidationError } from "@/lib/server/error";

/**
 * システム通知更新コマンド
 */
export interface UpdateSystemNotificationCommand {
  /** 通知ID */
  id: string;
  /** 通知メッセージ（省略時は変更なし） */
  message?: string;
  /** 表示順序（省略時は変更なし） */
  displayOrder?: number;
  /** 有効フラグ（省略時は変更なし） */
  isActive?: boolean;
}

/**
 * システム通知更新サービス
 * 管理者画面での通知更新に使用
 */
export class UpdateSystemNotificationService {
  constructor(
    private readonly systemNotificationRepository: ISystemNotificationRepository,
  ) {}

  /**
   * システム通知を更新する
   * @param command 更新コマンド
   * @returns 更新されたシステム通知DTO
   * @throws ドメインバリデーションエラー - 通知が存在しない場合
   */
  async execute(
    command: UpdateSystemNotificationCommand,
  ): Promise<SystemNotificationDto> {
    const { id, message, displayOrder, isActive } = command;

    // 対象の通知を取得
    const notificationId = SystemNotificationId.reconstruct(id);
    const notification =
      await this.systemNotificationRepository.findById(notificationId);

    if (!notification) {
      throw domainValidationError("SYSTEM_NOTIFICATION_NOT_FOUND");
    }

    // 通知を更新
    const updatedNotification = notification.update({
      message,
      displayOrder,
      isActive,
    });

    await this.systemNotificationRepository.save(updatedNotification);

    return updatedNotification.toDto();
  }
}
