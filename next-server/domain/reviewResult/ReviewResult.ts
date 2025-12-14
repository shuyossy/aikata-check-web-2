import { ReviewTargetId } from "@/domain/reviewTarget";
import { ReviewResultId } from "./ReviewResultId";
import { Evaluation } from "./Evaluation";
import { ReviewComment } from "./ReviewComment";

/**
 * レビュー結果作成パラメータ（成功時）
 */
export interface CreateReviewResultSuccessParams {
  reviewTargetId: string;
  /** チェック項目の内容（レビュー実行時点のスナップショット） */
  checkListItemContent: string;
  evaluation: string;
  comment: string;
}

/**
 * レビュー結果作成パラメータ（エラー時）
 */
export interface CreateReviewResultErrorParams {
  reviewTargetId: string;
  /** チェック項目の内容（レビュー実行時点のスナップショット） */
  checkListItemContent: string;
  errorMessage: string;
}

/**
 * レビュー結果復元パラメータ
 */
export interface ReconstructReviewResultParams {
  id: string;
  reviewTargetId: string;
  /** チェック項目の内容（レビュー実行時点のスナップショット） */
  checkListItemContent: string;
  evaluation: string | null;
  comment: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * レビュー結果DTO
 */
export interface ReviewResultDto {
  id: string;
  reviewTargetId: string;
  /** チェック項目の内容（レビュー実行時点のスナップショット） */
  checkListItemContent: string;
  evaluation: string | null;
  comment: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * レビュー結果エンティティ
 * 1つのチェック項目に対するAIレビュー結果を表す
 */
export class ReviewResult {
  private readonly _id: ReviewResultId;
  private readonly _reviewTargetId: ReviewTargetId;
  /** チェック項目の内容（レビュー実行時点のスナップショット） */
  private readonly _checkListItemContent: string;
  private readonly _evaluation: Evaluation;
  private readonly _comment: ReviewComment;
  private readonly _errorMessage: string | null;
  private readonly _createdAt: Date;
  private readonly _updatedAt: Date;

  private constructor(
    id: ReviewResultId,
    reviewTargetId: ReviewTargetId,
    checkListItemContent: string,
    evaluation: Evaluation,
    comment: ReviewComment,
    errorMessage: string | null,
    createdAt: Date,
    updatedAt: Date,
  ) {
    this._id = id;
    this._reviewTargetId = reviewTargetId;
    this._checkListItemContent = checkListItemContent;
    this._evaluation = evaluation;
    this._comment = comment;
    this._errorMessage = errorMessage;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
  }

  /**
   * 成功したレビュー結果を作成する
   * @throws ドメインバリデーションエラー - バリデーション失敗時
   */
  static createSuccess(params: CreateReviewResultSuccessParams): ReviewResult {
    const { reviewTargetId, checkListItemContent, evaluation, comment } = params;
    const now = new Date();

    return new ReviewResult(
      ReviewResultId.create(),
      ReviewTargetId.reconstruct(reviewTargetId),
      checkListItemContent,
      Evaluation.create(evaluation),
      ReviewComment.create(comment),
      null, // エラーなし
      now,
      now,
    );
  }

  /**
   * 失敗したレビュー結果を作成する
   * @throws ドメインバリデーションエラー - バリデーション失敗時
   */
  static createError(params: CreateReviewResultErrorParams): ReviewResult {
    const { reviewTargetId, checkListItemContent, errorMessage } = params;
    const now = new Date();

    return new ReviewResult(
      ReviewResultId.create(),
      ReviewTargetId.reconstruct(reviewTargetId),
      checkListItemContent,
      Evaluation.create(null),
      ReviewComment.create(null),
      errorMessage,
      now,
      now,
    );
  }

  /**
   * DBから取得したデータからレビュー結果を復元する
   */
  static reconstruct(params: ReconstructReviewResultParams): ReviewResult {
    return new ReviewResult(
      ReviewResultId.reconstruct(params.id),
      ReviewTargetId.reconstruct(params.reviewTargetId),
      params.checkListItemContent,
      Evaluation.reconstruct(params.evaluation),
      ReviewComment.reconstruct(params.comment),
      params.errorMessage,
      params.createdAt,
      params.updatedAt,
    );
  }

  /**
   * レビューが成功したかどうか
   */
  isSuccess(): boolean {
    return this._errorMessage === null;
  }

  /**
   * レビューが失敗したかどうか
   */
  isError(): boolean {
    return this._errorMessage !== null;
  }

  /**
   * DTOに変換する
   */
  toDto(): ReviewResultDto {
    return {
      id: this._id.value,
      reviewTargetId: this._reviewTargetId.value,
      checkListItemContent: this._checkListItemContent,
      evaluation: this._evaluation.value,
      comment: this._comment.value,
      errorMessage: this._errorMessage,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }

  // ゲッター
  get id(): ReviewResultId {
    return this._id;
  }

  get reviewTargetId(): ReviewTargetId {
    return this._reviewTargetId;
  }

  /** チェック項目の内容（レビュー実行時点のスナップショット） */
  get checkListItemContent(): string {
    return this._checkListItemContent;
  }

  get evaluation(): Evaluation {
    return this._evaluation;
  }

  get comment(): ReviewComment {
    return this._comment;
  }

  get errorMessage(): string | null {
    return this._errorMessage;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
