import { SystemNotificationId } from "./SystemNotificationId";
import { domainValidationError } from "@/lib/server/error";

/**
 * システム通知DTO
 * アプリケーション層への出力用
 */
export interface SystemNotificationDto {
  id: string;
  message: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * システム通知作成用パラメータ
 */
export interface CreateSystemNotificationParams {
  message: string;
  displayOrder?: number;
  isActive?: boolean;
}

/**
 * システム通知復元用パラメータ（DB復元用）
 */
export interface ReconstructSystemNotificationParams {
  id: string;
  message: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** メッセージの最大長 */
const MAX_MESSAGE_LENGTH = 1000;

/**
 * システム通知エンティティ
 * 全画面に表示するお知らせメッセージを管理
 */
export class SystemNotification {
  private readonly _id: SystemNotificationId;
  private readonly _message: string;
  private readonly _displayOrder: number;
  private readonly _isActive: boolean;
  private readonly _createdAt: Date;
  private readonly _updatedAt: Date;

  private constructor(
    id: SystemNotificationId,
    message: string,
    displayOrder: number,
    isActive: boolean,
    createdAt: Date,
    updatedAt: Date,
  ) {
    this._id = id;
    this._message = message;
    this._displayOrder = displayOrder;
    this._isActive = isActive;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
  }

  /**
   * 新規システム通知を作成する
   * @throws ドメインバリデーションエラー - バリデーション失敗時
   */
  static create(params: CreateSystemNotificationParams): SystemNotification {
    const { message, displayOrder = 0, isActive = true } = params;

    // バリデーション
    SystemNotification.validateMessage(message);

    const now = new Date();
    return new SystemNotification(
      SystemNotificationId.create(),
      message.trim(),
      displayOrder,
      isActive,
      now,
      now,
    );
  }

  /**
   * DBから取得したデータからシステム通知を復元する
   * @throws ドメインバリデーションエラー - バリデーション失敗時
   */
  static reconstruct(
    params: ReconstructSystemNotificationParams,
  ): SystemNotification {
    const { id, message, displayOrder, isActive, createdAt, updatedAt } =
      params;

    // バリデーション
    SystemNotification.validateMessage(message);

    return new SystemNotification(
      SystemNotificationId.reconstruct(id),
      message,
      displayOrder,
      isActive,
      createdAt,
      updatedAt,
    );
  }

  /**
   * メッセージのバリデーション
   * @throws ドメインバリデーションエラー - メッセージが不正な場合
   */
  private static validateMessage(message: string): void {
    if (!message || !message.trim()) {
      throw domainValidationError("SYSTEM_NOTIFICATION_MESSAGE_EMPTY");
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      throw domainValidationError("SYSTEM_NOTIFICATION_MESSAGE_TOO_LONG");
    }
  }

  /**
   * メッセージを更新する
   * 新しいインスタンスを返す（不変性を保持）
   */
  updateMessage(newMessage: string): SystemNotification {
    SystemNotification.validateMessage(newMessage);
    return new SystemNotification(
      this._id,
      newMessage.trim(),
      this._displayOrder,
      this._isActive,
      this._createdAt,
      new Date(),
    );
  }

  /**
   * 表示順序を更新する
   * 新しいインスタンスを返す（不変性を保持）
   */
  updateDisplayOrder(newDisplayOrder: number): SystemNotification {
    return new SystemNotification(
      this._id,
      this._message,
      newDisplayOrder,
      this._isActive,
      this._createdAt,
      new Date(),
    );
  }

  /**
   * 有効/無効を切り替える
   * 新しいインスタンスを返す（不変性を保持）
   */
  updateActiveStatus(isActive: boolean): SystemNotification {
    return new SystemNotification(
      this._id,
      this._message,
      this._displayOrder,
      isActive,
      this._createdAt,
      new Date(),
    );
  }

  /**
   * 複数項目を一括で更新する
   * 新しいインスタンスを返す（不変性を保持）
   */
  update(params: {
    message?: string;
    displayOrder?: number;
    isActive?: boolean;
  }): SystemNotification {
    const { message, displayOrder, isActive } = params;

    const newMessage = message !== undefined ? message : this._message;
    const newDisplayOrder =
      displayOrder !== undefined ? displayOrder : this._displayOrder;
    const newIsActive = isActive !== undefined ? isActive : this._isActive;

    // メッセージが変更された場合はバリデーション
    if (message !== undefined) {
      SystemNotification.validateMessage(message);
    }

    return new SystemNotification(
      this._id,
      newMessage.trim(),
      newDisplayOrder,
      newIsActive,
      this._createdAt,
      new Date(),
    );
  }

  /**
   * DTOに変換する
   */
  toDto(): SystemNotificationDto {
    return {
      id: this._id.value,
      message: this._message,
      displayOrder: this._displayOrder,
      isActive: this._isActive,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }

  // ゲッター
  get id(): SystemNotificationId {
    return this._id;
  }

  get message(): string {
    return this._message;
  }

  get displayOrder(): number {
    return this._displayOrder;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
