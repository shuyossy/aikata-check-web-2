import {
  SystemNotification,
  SystemNotificationId,
} from "@/domain/system-notification";

/**
 * システム通知取得オプション
 */
export interface FindSystemNotificationsOptions {
  /** 取得件数 */
  limit?: number;
  /** オフセット */
  offset?: number;
  /** 有効な通知のみ取得 */
  activeOnly?: boolean;
}

/**
 * システム通知リポジトリインターフェース
 * インフラ層で実装される
 */
export interface ISystemNotificationRepository {
  /**
   * 全てのシステム通知を取得（表示順序でソート）
   * @param options 取得オプション
   * @returns システム通知エンティティの配列
   */
  findAll(
    options?: FindSystemNotificationsOptions,
  ): Promise<SystemNotification[]>;

  /**
   * 有効なシステム通知のみ取得（表示順序でソート）
   * 全画面表示用
   * @returns 有効なシステム通知エンティティの配列
   */
  findActiveNotifications(): Promise<SystemNotification[]>;

  /**
   * IDでシステム通知を取得
   * @param id システム通知ID
   * @returns システム通知エンティティ（存在しない場合はnull）
   */
  findById(id: SystemNotificationId): Promise<SystemNotification | null>;

  /**
   * システム通知を保存（新規作成または更新）
   * @param notification システム通知エンティティ
   */
  save(notification: SystemNotification): Promise<void>;

  /**
   * システム通知を削除
   * @param id システム通知ID
   */
  delete(id: SystemNotificationId): Promise<void>;

  /**
   * システム通知の総数をカウント
   * @param activeOnly 有効な通知のみカウントする場合はtrue
   * @returns 件数
   */
  count(activeOnly?: boolean): Promise<number>;
}
