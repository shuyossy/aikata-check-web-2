import { UserId } from "@/domain/user";

/**
 * プロジェクトメンバー作成パラメータ
 */
export interface CreateProjectMemberParams {
  userId: string;
}

/**
 * プロジェクトメンバー復元パラメータ
 */
export interface ReconstructProjectMemberParams {
  userId: string;
  createdAt: Date;
}

/**
 * プロジェクトメンバーエンティティ
 * プロジェクトに所属するユーザを表現
 */
export class ProjectMember {
  private readonly _userId: UserId;
  private readonly _createdAt: Date;

  private constructor(userId: UserId, createdAt: Date) {
    this._userId = userId;
    this._createdAt = createdAt;
  }

  /**
   * 新規メンバーを作成する
   */
  static create(params: CreateProjectMemberParams): ProjectMember {
    return new ProjectMember(UserId.reconstruct(params.userId), new Date());
  }

  /**
   * DBから取得したデータからメンバーを復元する
   */
  static reconstruct(params: ReconstructProjectMemberParams): ProjectMember {
    return new ProjectMember(
      UserId.reconstruct(params.userId),
      params.createdAt,
    );
  }

  /**
   * ユーザIDを取得
   */
  get userId(): UserId {
    return this._userId;
  }

  /**
   * メンバー追加日時を取得
   */
  get createdAt(): Date {
    return this._createdAt;
  }

  /**
   * 指定したユーザIDと一致するか確認
   */
  hasUserId(userId: UserId): boolean {
    return this._userId.equals(userId);
  }
}
