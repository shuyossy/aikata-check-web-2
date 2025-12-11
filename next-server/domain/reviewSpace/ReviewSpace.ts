import { ProjectId } from "@/domain/project";
import { ReviewSpaceId } from "./ReviewSpaceId";
import { ReviewSpaceName } from "./ReviewSpaceName";
import { ReviewSpaceDescription } from "./ReviewSpaceDescription";

/**
 * レビュースペースDTO
 * アプリケーション層への出力用
 */
export interface ReviewSpaceDto {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * レビュースペース一覧用DTO
 */
export interface ReviewSpaceListItemDto {
  id: string;
  name: string;
  description: string | null;
  updatedAt: string;
}

/**
 * レビュースペース作成パラメータ
 */
export interface CreateReviewSpaceParams {
  projectId: string;
  name: string;
  description?: string | null;
}

/**
 * レビュースペース復元パラメータ
 */
export interface ReconstructReviewSpaceParams {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * レビュースペースエンティティ（集約ルート）
 * プロジェクト内でチェックリストを運用するための単位
 */
export class ReviewSpace {
  private readonly _id: ReviewSpaceId;
  private readonly _projectId: ProjectId;
  private readonly _name: ReviewSpaceName;
  private readonly _description: ReviewSpaceDescription;
  private readonly _createdAt: Date;
  private readonly _updatedAt: Date;

  private constructor(
    id: ReviewSpaceId,
    projectId: ProjectId,
    name: ReviewSpaceName,
    description: ReviewSpaceDescription,
    createdAt: Date,
    updatedAt: Date,
  ) {
    this._id = id;
    this._projectId = projectId;
    this._name = name;
    this._description = description;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
  }

  /**
   * 新規レビュースペースを作成する
   * @throws ドメインバリデーションエラー - バリデーション失敗時
   */
  static create(params: CreateReviewSpaceParams): ReviewSpace {
    const { projectId, name, description } = params;
    const now = new Date();

    return new ReviewSpace(
      ReviewSpaceId.create(),
      ProjectId.reconstruct(projectId),
      ReviewSpaceName.create(name),
      ReviewSpaceDescription.create(description),
      now,
      now,
    );
  }

  /**
   * DBから取得したデータからレビュースペースを復元する
   */
  static reconstruct(params: ReconstructReviewSpaceParams): ReviewSpace {
    return new ReviewSpace(
      ReviewSpaceId.reconstruct(params.id),
      ProjectId.reconstruct(params.projectId),
      ReviewSpaceName.reconstruct(params.name),
      ReviewSpaceDescription.reconstruct(params.description),
      params.createdAt,
      params.updatedAt,
    );
  }

  /**
   * スペース名を更新する
   * 新しいReviewSpaceインスタンスを返す（不変性を保持）
   */
  updateName(newName: string): ReviewSpace {
    return new ReviewSpace(
      this._id,
      this._projectId,
      ReviewSpaceName.create(newName),
      this._description,
      this._createdAt,
      new Date(),
    );
  }

  /**
   * スペース説明を更新する
   * 新しいReviewSpaceインスタンスを返す（不変性を保持）
   */
  updateDescription(newDescription: string | null): ReviewSpace {
    return new ReviewSpace(
      this._id,
      this._projectId,
      this._name,
      ReviewSpaceDescription.create(newDescription),
      this._createdAt,
      new Date(),
    );
  }

  /**
   * DTOに変換する
   */
  toDto(): ReviewSpaceDto {
    return {
      id: this._id.value,
      projectId: this._projectId.value,
      name: this._name.value,
      description: this._description.value,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }

  /**
   * 一覧用DTOに変換する
   */
  toListItemDto(): ReviewSpaceListItemDto {
    return {
      id: this._id.value,
      name: this._name.value,
      description: this._description.value,
      updatedAt: this._updatedAt.toISOString(),
    };
  }

  // ゲッター
  get id(): ReviewSpaceId {
    return this._id;
  }

  get projectId(): ProjectId {
    return this._projectId;
  }

  get name(): ReviewSpaceName {
    return this._name;
  }

  get description(): ReviewSpaceDescription {
    return this._description;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
