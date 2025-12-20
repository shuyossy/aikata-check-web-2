import { ISystemNotificationRepository } from "@/application/shared/port/repository";
import { SystemNotificationId } from "@/domain/system-notification";
import { domainValidationError } from "@/lib/server/error";

/**
 * システム通知削除コマンド
 */
export interface DeleteSystemNotificationCommand {
  /** 通知ID */
  id: string;
}

/**
 * システム通知削除サービス
 * 管理者画面での通知削除に使用
 */
export class DeleteSystemNotificationService {
  constructor(
    private readonly systemNotificationRepository: ISystemNotificationRepository,
  ) {}

  /**
   * システム通知を削除する
   * @param command 削除コマンド
   * @throws ドメインバリデーションエラー - 通知が存在しない場合
   */
  async execute(command: DeleteSystemNotificationCommand): Promise<void> {
    const { id } = command;

    // 対象の通知を取得して存在確認
    const notificationId = SystemNotificationId.reconstruct(id);
    const notification = await this.systemNotificationRepository.findById(notificationId);

    if (!notification) {
      throw domainValidationError("SYSTEM_NOTIFICATION_NOT_FOUND");
    }

    // 通知を削除
    await this.systemNotificationRepository.delete(notificationId);
  }
}
