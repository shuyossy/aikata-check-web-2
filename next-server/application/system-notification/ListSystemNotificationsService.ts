import {
  ISystemNotificationRepository,
  FindSystemNotificationsOptions,
} from "@/application/shared/port/repository";
import { SystemNotificationDto } from "@/domain/system-notification";

/**
 * システム通知一覧取得クエリ
 */
export interface ListSystemNotificationsQuery {
  /** 取得件数 */
  limit?: number;
  /** オフセット */
  offset?: number;
  /** 有効な通知のみ取得 */
  activeOnly?: boolean;
}

/**
 * システム通知一覧取得結果
 */
export interface ListSystemNotificationsResult {
  /** システム通知一覧 */
  notifications: SystemNotificationDto[];
  /** 総件数 */
  total: number;
}

/**
 * システム通知一覧取得サービス
 * 管理者画面での通知一覧表示に使用
 */
export class ListSystemNotificationsService {
  constructor(
    private readonly systemNotificationRepository: ISystemNotificationRepository,
  ) {}

  /**
   * システム通知一覧を取得する
   * @param query 取得クエリ
   * @returns システム通知一覧と総件数
   */
  async execute(
    query: ListSystemNotificationsQuery = {},
  ): Promise<ListSystemNotificationsResult> {
    const { limit, offset, activeOnly } = query;

    const options: FindSystemNotificationsOptions = {
      limit,
      offset,
      activeOnly,
    };

    const [notifications, total] = await Promise.all([
      this.systemNotificationRepository.findAll(options),
      this.systemNotificationRepository.count(activeOnly),
    ]);

    return {
      notifications: notifications.map((notification) => notification.toDto()),
      total,
    };
  }
}
