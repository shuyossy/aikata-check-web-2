import { ISystemNotificationRepository } from "@/application/shared/port/repository";
import {
  SystemNotification,
  SystemNotificationDto,
} from "@/domain/system-notification";

/**
 * システム通知作成コマンド
 */
export interface CreateSystemNotificationCommand {
  /** 通知メッセージ */
  message: string;
  /** 表示順序（デフォルト: 0） */
  displayOrder?: number;
  /** 有効フラグ（デフォルト: true） */
  isActive?: boolean;
}

/**
 * システム通知作成サービス
 * 管理者画面での通知作成に使用
 */
export class CreateSystemNotificationService {
  constructor(
    private readonly systemNotificationRepository: ISystemNotificationRepository,
  ) {}

  /**
   * システム通知を作成する
   * @param command 作成コマンド
   * @returns 作成されたシステム通知DTO
   */
  async execute(
    command: CreateSystemNotificationCommand,
  ): Promise<SystemNotificationDto> {
    const { message, displayOrder, isActive } = command;

    const notification = SystemNotification.create({
      message,
      displayOrder,
      isActive,
    });

    await this.systemNotificationRepository.save(notification);

    return notification.toDto();
  }
}
