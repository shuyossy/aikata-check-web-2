import { ReviewSpaceId } from "@/domain/reviewSpace";
import {
  ReviewSettings,
  ReviewSettingsDto,
  ReviewSettingsProps,
} from "@/domain/reviewSpace/ReviewSettings";
import { ReviewTargetId } from "./ReviewTargetId";
import { ReviewTargetName } from "./ReviewTargetName";
import {
  ReviewTargetStatus,
  ReviewTargetStatusType,
} from "./ReviewTargetStatus";

/**
 * レビュー対象作成パラメータ
 */
export interface CreateReviewTargetParams {
  reviewSpaceId: string;
  name: string;
  reviewSettings?: ReviewSettingsProps | null;
}

/**
 * レビュー対象復元パラメータ
 */
export interface ReconstructReviewTargetParams {
  id: string;
  reviewSpaceId: string;
  name: string;
  status: string;
  reviewSettings: ReviewSettingsProps | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * レビュー対象DTO
 */
export interface ReviewTargetDto {
  id: string;
  reviewSpaceId: string;
  name: string;
  status: ReviewTargetStatusType;
  reviewSettings: ReviewSettingsDto | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * レビュー対象一覧アイテムDTO
 */
export interface ReviewTargetListItemDto {
  id: string;
  name: string;
  status: ReviewTargetStatusType;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * レビュー対象エンティティ
 * AIレビューの対象となるドキュメント群を表す
 */
export class ReviewTarget {
  private readonly _id: ReviewTargetId;
  private readonly _reviewSpaceId: ReviewSpaceId;
  private readonly _name: ReviewTargetName;
  private readonly _status: ReviewTargetStatus;
  private readonly _reviewSettings: ReviewSettings | null;
  private readonly _createdAt: Date;
  private readonly _updatedAt: Date;

  private constructor(
    id: ReviewTargetId,
    reviewSpaceId: ReviewSpaceId,
    name: ReviewTargetName,
    status: ReviewTargetStatus,
    reviewSettings: ReviewSettings | null,
    createdAt: Date,
    updatedAt: Date,
  ) {
    this._id = id;
    this._reviewSpaceId = reviewSpaceId;
    this._name = name;
    this._status = status;
    this._reviewSettings = reviewSettings;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
  }

  /**
   * 新規レビュー対象を作成する
   * @throws ドメインバリデーションエラー - バリデーション失敗時
   */
  static create(params: CreateReviewTargetParams): ReviewTarget {
    const { reviewSpaceId, name, reviewSettings } = params;
    const now = new Date();

    // レビュー設定の生成（nullの場合はnullを維持）
    const settings = reviewSettings
      ? ReviewSettings.create(reviewSettings)
      : null;

    return new ReviewTarget(
      ReviewTargetId.create(),
      ReviewSpaceId.reconstruct(reviewSpaceId),
      ReviewTargetName.create(name),
      ReviewTargetStatus.create(), // 初期状態はpending
      settings,
      now,
      now,
    );
  }

  /**
   * DBから取得したデータからレビュー対象を復元する
   */
  static reconstruct(params: ReconstructReviewTargetParams): ReviewTarget {
    // レビュー設定の復元（nullの場合はnullを維持）
    const settings = params.reviewSettings
      ? ReviewSettings.reconstruct(params.reviewSettings)
      : null;

    return new ReviewTarget(
      ReviewTargetId.reconstruct(params.id),
      ReviewSpaceId.reconstruct(params.reviewSpaceId),
      ReviewTargetName.reconstruct(params.name),
      ReviewTargetStatus.reconstruct(params.status),
      settings,
      params.createdAt,
      params.updatedAt,
    );
  }

  /**
   * レビュー実行中状態に遷移する
   * 新しいReviewTargetインスタンスを返す（不変性を保持）
   * @throws ドメインバリデーションエラー - 遷移が不正な場合
   */
  startReviewing(): ReviewTarget {
    return new ReviewTarget(
      this._id,
      this._reviewSpaceId,
      this._name,
      this._status.toReviewing(),
      this._reviewSettings,
      this._createdAt,
      new Date(),
    );
  }

  /**
   * レビュー完了状態に遷移する
   * 新しいReviewTargetインスタンスを返す（不変性を保持）
   * @throws ドメインバリデーションエラー - 遷移が不正な場合
   */
  completeReview(): ReviewTarget {
    return new ReviewTarget(
      this._id,
      this._reviewSpaceId,
      this._name,
      this._status.toCompleted(),
      this._reviewSettings,
      this._createdAt,
      new Date(),
    );
  }

  /**
   * エラー状態に遷移する
   * 新しいReviewTargetインスタンスを返す（不変性を保持）
   * @throws ドメインバリデーションエラー - 遷移が不正な場合
   */
  markAsError(): ReviewTarget {
    return new ReviewTarget(
      this._id,
      this._reviewSpaceId,
      this._name,
      this._status.toError(),
      this._reviewSettings,
      this._createdAt,
      new Date(),
    );
  }

  /**
   * 削除可能かどうかを判定する
   * レビュー実行中は削除不可
   */
  canDelete(): boolean {
    return !this._status.isReviewing();
  }

  /**
   * DTOに変換する
   */
  toDto(): ReviewTargetDto {
    return {
      id: this._id.value,
      reviewSpaceId: this._reviewSpaceId.value,
      name: this._name.value,
      status: this._status.value,
      reviewSettings: this._reviewSettings?.toDto() ?? null,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }

  /**
   * 一覧用DTOに変換する
   */
  toListItemDto(): ReviewTargetListItemDto {
    return {
      id: this._id.value,
      name: this._name.value,
      status: this._status.value,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }

  // ゲッター
  get id(): ReviewTargetId {
    return this._id;
  }

  get reviewSpaceId(): ReviewSpaceId {
    return this._reviewSpaceId;
  }

  get name(): ReviewTargetName {
    return this._name;
  }

  get status(): ReviewTargetStatus {
    return this._status;
  }

  get reviewSettings(): ReviewSettings | null {
    return this._reviewSettings;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
