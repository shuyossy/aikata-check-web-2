import { UserId } from "@/domain/user";
import { ProjectId } from "./ProjectId";
import { ProjectName } from "./ProjectName";
import { ProjectDescription } from "./ProjectDescription";
import { EncryptedApiKey } from "./EncryptedApiKey";
import { ProjectMember } from "./ProjectMember";
import { domainValidationError } from "@/lib/server/error";

/**
 * プロジェクトDTO
 * アプリケーション層への出力用
 */
export interface ProjectDto {
  id: string;
  name: string;
  description: string | null;
  hasApiKey: boolean;
  members: ProjectMemberDto[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * プロジェクトメンバーDTO
 */
export interface ProjectMemberDto {
  userId: string;
  employeeId: string;
  displayName: string;
  createdAt: Date;
}

/**
 * ユーザ情報（表示名とemployeeId）
 * toDto/toListItemDtoで使用
 */
export interface UserInfo {
  displayName: string;
  employeeId: string;
}

/**
 * プロジェクト一覧用メンバープレビューDTO
 */
export interface MemberPreviewDto {
  userId: string;
  displayName: string;
}

/**
 * プロジェクト一覧用DTO
 */
export interface ProjectListItemDto {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  memberPreview: MemberPreviewDto[];
  updatedAt: string;
}

/**
 * プロジェクト作成パラメータ
 */
export interface CreateProjectParams {
  name: string;
  description?: string | null;
  apiKey?: string | null;
  memberIds: string[];
}

/**
 * プロジェクト復元パラメータ
 */
export interface ReconstructProjectParams {
  id: string;
  name: string;
  description: string | null;
  encryptedApiKey: string | null;
  members: { userId: string; createdAt: Date }[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * プロジェクトエンティティ（集約ルート）
 * 複数ユーザが参加するレビュープロジェクトを表現
 */
export class Project {
  private readonly _id: ProjectId;
  private readonly _name: ProjectName;
  private readonly _description: ProjectDescription;
  private readonly _encryptedApiKey: EncryptedApiKey;
  private readonly _members: ProjectMember[];
  private readonly _createdAt: Date;
  private readonly _updatedAt: Date;

  private constructor(
    id: ProjectId,
    name: ProjectName,
    description: ProjectDescription,
    encryptedApiKey: EncryptedApiKey,
    members: ProjectMember[],
    createdAt: Date,
    updatedAt: Date,
  ) {
    this._id = id;
    this._name = name;
    this._description = description;
    this._encryptedApiKey = encryptedApiKey;
    this._members = members;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
  }

  /**
   * 新規プロジェクトを作成する
   * @throws ドメインバリデーションエラー - バリデーション失敗時
   */
  static create(params: CreateProjectParams): Project {
    const { name, description, apiKey, memberIds } = params;

    // メンバーが1人以上必要
    if (!memberIds || memberIds.length === 0) {
      throw domainValidationError("PROJECT_MEMBER_REQUIRED");
    }

    const now = new Date();
    const members = memberIds.map((userId) => ProjectMember.create({ userId }));

    return new Project(
      ProjectId.create(),
      ProjectName.create(name),
      ProjectDescription.create(description),
      EncryptedApiKey.fromPlainText(apiKey),
      members,
      now,
      now,
    );
  }

  /**
   * DBから取得したデータからプロジェクトを復元する
   */
  static reconstruct(params: ReconstructProjectParams): Project {
    const members = params.members.map((m) =>
      ProjectMember.reconstruct({
        userId: m.userId,
        createdAt: m.createdAt,
      }),
    );

    return new Project(
      ProjectId.reconstruct(params.id),
      ProjectName.reconstruct(params.name),
      ProjectDescription.reconstruct(params.description),
      EncryptedApiKey.reconstruct(params.encryptedApiKey),
      members,
      params.createdAt,
      params.updatedAt,
    );
  }

  /**
   * プロジェクト名を更新する
   * 新しいProjectインスタンスを返す（不変性を保持）
   */
  updateName(newName: string): Project {
    return new Project(
      this._id,
      ProjectName.create(newName),
      this._description,
      this._encryptedApiKey,
      this._members,
      this._createdAt,
      new Date(),
    );
  }

  /**
   * プロジェクト説明を更新する
   * 新しいProjectインスタンスを返す（不変性を保持）
   */
  updateDescription(newDescription: string | null): Project {
    return new Project(
      this._id,
      this._name,
      ProjectDescription.create(newDescription),
      this._encryptedApiKey,
      this._members,
      this._createdAt,
      new Date(),
    );
  }

  /**
   * APIキーを更新する
   * 新しいProjectインスタンスを返す（不変性を保持）
   */
  updateApiKey(newApiKey: string | null): Project {
    return new Project(
      this._id,
      this._name,
      this._description,
      EncryptedApiKey.fromPlainText(newApiKey),
      this._members,
      this._createdAt,
      new Date(),
    );
  }

  /**
   * メンバーを追加する
   * @throws ドメインバリデーションエラー - 既に存在する場合
   */
  addMember(userId: string): Project {
    const userIdVo = UserId.reconstruct(userId);

    // 既にメンバーかどうか確認
    if (this.hasMember(userId)) {
      throw domainValidationError("PROJECT_MEMBER_ALREADY_EXISTS");
    }

    const newMember = ProjectMember.create({ userId });
    const newMembers = [...this._members, newMember];

    return new Project(
      this._id,
      this._name,
      this._description,
      this._encryptedApiKey,
      newMembers,
      this._createdAt,
      new Date(),
    );
  }

  /**
   * メンバーを削除する
   * @throws ドメインバリデーションエラー - メンバーが見つからない場合、または最後の1人の場合
   */
  removeMember(userId: string): Project {
    const userIdVo = UserId.reconstruct(userId);

    // メンバーかどうか確認
    if (!this.hasMember(userId)) {
      throw domainValidationError("PROJECT_MEMBER_NOT_FOUND");
    }

    // 最後の1人は削除できない
    if (this._members.length === 1) {
      throw domainValidationError("PROJECT_MEMBER_REQUIRED");
    }

    const newMembers = this._members.filter((m) => !m.hasUserId(userIdVo));

    return new Project(
      this._id,
      this._name,
      this._description,
      this._encryptedApiKey,
      newMembers,
      this._createdAt,
      new Date(),
    );
  }

  /**
   * メンバーリストを同期する（追加・削除を一括で行う）
   * @throws ドメインバリデーションエラー - メンバーが空の場合
   */
  syncMembers(memberIds: string[]): Project {
    if (!memberIds || memberIds.length === 0) {
      throw domainValidationError("PROJECT_MEMBER_REQUIRED");
    }

    // 既存メンバーのマップを作成（createdAtを保持するため）
    const existingMembersMap = new Map<string, ProjectMember>();
    for (const member of this._members) {
      existingMembersMap.set(member.userId.value, member);
    }

    // 新しいメンバーリストを作成
    const newMembers = memberIds.map((userId) => {
      const existing = existingMembersMap.get(userId);
      if (existing) {
        return existing;
      }
      return ProjectMember.create({ userId });
    });

    return new Project(
      this._id,
      this._name,
      this._description,
      this._encryptedApiKey,
      newMembers,
      this._createdAt,
      new Date(),
    );
  }

  /**
   * 指定ユーザがメンバーか確認
   */
  hasMember(userId: string): boolean {
    const userIdVo = UserId.reconstruct(userId);
    return this._members.some((m) => m.hasUserId(userIdVo));
  }

  /**
   * DTOに変換する
   * @param userInfoMap ユーザIDとユーザ情報（displayName, employeeId）のマップ
   */
  toDto(userInfoMap: Map<string, UserInfo>): ProjectDto {
    const defaultUserInfo: UserInfo = {
      displayName: "Unknown",
      employeeId: "",
    };
    return {
      id: this._id.value,
      name: this._name.value,
      description: this._description.value,
      hasApiKey: this._encryptedApiKey.hasValue(),
      members: this._members.map((m) => {
        const userInfo = userInfoMap.get(m.userId.value) ?? defaultUserInfo;
        return {
          userId: m.userId.value,
          employeeId: userInfo.employeeId,
          displayName: userInfo.displayName,
          createdAt: m.createdAt,
        };
      }),
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }

  /**
   * 一覧用DTOに変換する
   * @param userNameMap ユーザIDと表示名のマップ
   * @param previewCount 表示するメンバープレビューの数（デフォルト5）
   */
  toListItemDto(
    userNameMap: Map<string, string>,
    previewCount: number = 5,
  ): ProjectListItemDto {
    return {
      id: this._id.value,
      name: this._name.value,
      description: this._description.value,
      memberCount: this._members.length,
      memberPreview: this._members.slice(0, previewCount).map((m) => ({
        userId: m.userId.value,
        displayName: userNameMap.get(m.userId.value) ?? "Unknown",
      })),
      updatedAt: this._updatedAt.toISOString(),
    };
  }

  // ゲッター
  get id(): ProjectId {
    return this._id;
  }

  get name(): ProjectName {
    return this._name;
  }

  get description(): ProjectDescription {
    return this._description;
  }

  get encryptedApiKey(): EncryptedApiKey {
    return this._encryptedApiKey;
  }

  get members(): ProjectMember[] {
    return [...this._members];
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
