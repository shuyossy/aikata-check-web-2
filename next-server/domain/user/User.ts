import { UserId } from "./UserId";
import { EmployeeId } from "./EmployeeId";
import { domainValidationError } from "@/lib/server/error";

/**
 * ユーザDTO
 * アプリケーション層への出力用
 */
export interface UserDto {
  id: string;
  employeeId: string;
  displayName: string;
}

/**
 * ユーザ作成用パラメータ
 */
export interface CreateUserParams {
  employeeId: string;
  displayName: string;
}

/**
 * ユーザ復元用パラメータ
 */
export interface ReconstructUserParams {
  id: string;
  employeeId: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ユーザエンティティ（集約ルート）
 * Keycloakで認証されたユーザを表現
 */
export class User {
  private readonly _id: UserId;
  private readonly _employeeId: EmployeeId;
  private readonly _displayName: string;
  private readonly _createdAt: Date;
  private readonly _updatedAt: Date;

  private constructor(
    id: UserId,
    employeeId: EmployeeId,
    displayName: string,
    createdAt: Date,
    updatedAt: Date,
  ) {
    this._id = id;
    this._employeeId = employeeId;
    this._displayName = displayName;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
  }

  /**
   * 新規ユーザを作成する
   * @throws ドメインバリデーションエラー - バリデーション失敗時
   */
  static create(params: CreateUserParams): User {
    const { employeeId, displayName } = params;

    // 表示名のバリデーション
    User.validateDisplayName(displayName);

    const now = new Date();
    return new User(
      UserId.create(),
      EmployeeId.create(employeeId),
      displayName,
      now,
      now,
    );
  }

  /**
   * DBから取得したデータからユーザを復元する
   * @throws ドメインバリデーションエラー - バリデーション失敗時
   */
  static reconstruct(params: ReconstructUserParams): User {
    const { id, employeeId, displayName, createdAt, updatedAt } = params;

    // 表示名のバリデーション
    User.validateDisplayName(displayName);

    return new User(
      UserId.reconstruct(id),
      EmployeeId.reconstruct(employeeId),
      displayName,
      createdAt,
      updatedAt,
    );
  }

  /**
   * 表示名のバリデーション
   * @throws ドメインバリデーションエラー - 表示名が不正な場合
   */
  private static validateDisplayName(displayName: string): void {
    if (!displayName || !displayName.trim()) {
      throw domainValidationError("DISPLAY_NAME_EMPTY");
    }
  }

  /**
   * 表示名を更新する
   * 新しいUserインスタンスを返す（不変性を保持）
   */
  updateDisplayName(newDisplayName: string): User {
    User.validateDisplayName(newDisplayName);
    return new User(
      this._id,
      this._employeeId,
      newDisplayName,
      this._createdAt,
      new Date(),
    );
  }

  /**
   * 表示名が変更されたかどうかを判定
   */
  hasDisplayNameChanged(newDisplayName: string): boolean {
    return this._displayName !== newDisplayName;
  }

  /**
   * DTOに変換する
   */
  toDto(): UserDto {
    return {
      id: this._id.value,
      employeeId: this._employeeId.value,
      displayName: this._displayName,
    };
  }

  // ゲッター
  get id(): UserId {
    return this._id;
  }

  get employeeId(): EmployeeId {
    return this._employeeId;
  }

  get displayName(): string {
    return this._displayName;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
