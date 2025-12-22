import { ProjectId } from "@/domain/project";
import { ReviewSpaceId } from "./ReviewSpaceId";
import { ReviewSpaceName } from "./ReviewSpaceName";
import { ReviewSpaceDescription } from "./ReviewSpaceDescription";
import {
  ReviewSettings,
  ReviewSettingsProps,
  ReviewSettingsDto,
} from "./ReviewSettings";

/**
 * レビュースペースDTO
 * アプリケーション層への出力用
 */
export interface ReviewSpaceDto {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  defaultReviewSettings: ReviewSettingsDto;
  createdAt: Date;
  updatedAt: Date;
  /** チェックリスト生成エラーメッセージ（最新のエラーのみ保持） */
  checklistGenerationError: string | null;
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
  defaultReviewSettings?: ReviewSettingsProps | null;
}

/**
 * レビュースペース復元パラメータ
 */
export interface ReconstructReviewSpaceParams {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  defaultReviewSettings?: ReviewSettingsProps | null;
  createdAt: Date;
  updatedAt: Date;
  /** チェックリスト生成エラーメッセージ */
  checklistGenerationError?: string | null;
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
  private readonly _defaultReviewSettings: ReviewSettings;
  private readonly _createdAt: Date;
  private readonly _updatedAt: Date;
  private readonly _checklistGenerationError: string | null;

  private constructor(
    id: ReviewSpaceId,
    projectId: ProjectId,
    name: ReviewSpaceName,
    description: ReviewSpaceDescription,
    defaultReviewSettings: ReviewSettings,
    createdAt: Date,
    updatedAt: Date,
    checklistGenerationError: string | null = null,
  ) {
    this._id = id;
    this._projectId = projectId;
    this._name = name;
    this._description = description;
    this._defaultReviewSettings = defaultReviewSettings;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
    this._checklistGenerationError = checklistGenerationError;
  }

  /**
   * 新規レビュースペースを作成する
   * @throws ドメインバリデーションエラー - バリデーション失敗時
   */
  static create(params: CreateReviewSpaceParams): ReviewSpace {
    const { projectId, name, description, defaultReviewSettings } = params;
    const now = new Date();

    // レビュー設定の生成（nullの場合はデフォルト値を使用）
    const settings = defaultReviewSettings
      ? ReviewSettings.create(defaultReviewSettings)
      : ReviewSettings.createDefault();

    return new ReviewSpace(
      ReviewSpaceId.create(),
      ProjectId.reconstruct(projectId),
      ReviewSpaceName.create(name),
      ReviewSpaceDescription.create(description),
      settings,
      now,
      now,
    );
  }

  /**
   * DBから取得したデータからレビュースペースを復元する
   */
  static reconstruct(params: ReconstructReviewSpaceParams): ReviewSpace {
    // レビュー設定の復元（nullの場合はデフォルト値を使用）
    const settings = params.defaultReviewSettings
      ? ReviewSettings.reconstruct(params.defaultReviewSettings)
      : ReviewSettings.createDefault();

    return new ReviewSpace(
      ReviewSpaceId.reconstruct(params.id),
      ProjectId.reconstruct(params.projectId),
      ReviewSpaceName.reconstruct(params.name),
      ReviewSpaceDescription.reconstruct(params.description),
      settings,
      params.createdAt,
      params.updatedAt,
      params.checklistGenerationError ?? null,
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
      this._defaultReviewSettings,
      this._createdAt,
      new Date(),
      this._checklistGenerationError,
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
      this._defaultReviewSettings,
      this._createdAt,
      new Date(),
      this._checklistGenerationError,
    );
  }

  /**
   * デフォルトレビュー設定を更新する
   * 新しいReviewSpaceインスタンスを返す（不変性を保持）
   */
  updateDefaultReviewSettings(settings: ReviewSettingsProps): ReviewSpace {
    const newSettings = ReviewSettings.create(settings);

    return new ReviewSpace(
      this._id,
      this._projectId,
      this._name,
      this._description,
      newSettings,
      this._createdAt,
      new Date(),
      this._checklistGenerationError,
    );
  }

  /**
   * チェックリスト生成エラーを設定する
   * 新しいReviewSpaceインスタンスを返す（不変性を保持）
   */
  setChecklistGenerationError(errorMessage: string): ReviewSpace {
    return new ReviewSpace(
      this._id,
      this._projectId,
      this._name,
      this._description,
      this._defaultReviewSettings,
      this._createdAt,
      this._updatedAt,
      errorMessage,
    );
  }

  /**
   * チェックリスト生成エラーをクリアする
   * 新しいReviewSpaceインスタンスを返す（不変性を保持）
   */
  clearChecklistGenerationError(): ReviewSpace {
    return new ReviewSpace(
      this._id,
      this._projectId,
      this._name,
      this._description,
      this._defaultReviewSettings,
      this._createdAt,
      this._updatedAt,
      null,
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
      defaultReviewSettings: this._defaultReviewSettings.toDto(),
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
      checklistGenerationError: this._checklistGenerationError,
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

  get defaultReviewSettings(): ReviewSettings {
    return this._defaultReviewSettings;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get checklistGenerationError(): string | null {
    return this._checklistGenerationError;
  }
}
