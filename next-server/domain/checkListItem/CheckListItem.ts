import { ReviewSpaceId } from "@/domain/reviewSpace";
import { CheckListItemId } from "./CheckListItemId";
import { CheckListItemContent } from "./CheckListItemContent";

/**
 * チェック項目DTO
 * アプリケーション層への出力用
 */
export interface CheckListItemDto {
  id: string;
  reviewSpaceId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * チェック項目一覧用DTO
 */
export interface CheckListItemListItemDto {
  id: string;
  content: string;
}

/**
 * チェック項目作成パラメータ
 */
export interface CreateCheckListItemParams {
  reviewSpaceId: string;
  content: string;
}

/**
 * チェック項目復元パラメータ
 */
export interface ReconstructCheckListItemParams {
  id: string;
  reviewSpaceId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * チェック項目エンティティ
 * レビュースペース内のチェック項目を表現する
 */
export class CheckListItem {
  private readonly _id: CheckListItemId;
  private readonly _reviewSpaceId: ReviewSpaceId;
  private readonly _content: CheckListItemContent;
  private readonly _createdAt: Date;
  private readonly _updatedAt: Date;

  private constructor(
    id: CheckListItemId,
    reviewSpaceId: ReviewSpaceId,
    content: CheckListItemContent,
    createdAt: Date,
    updatedAt: Date,
  ) {
    this._id = id;
    this._reviewSpaceId = reviewSpaceId;
    this._content = content;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
  }

  /**
   * 新規チェック項目を作成する
   * @throws ドメインバリデーションエラー - バリデーション失敗時
   */
  static create(params: CreateCheckListItemParams): CheckListItem {
    const { reviewSpaceId, content } = params;
    const now = new Date();

    return new CheckListItem(
      CheckListItemId.create(),
      ReviewSpaceId.reconstruct(reviewSpaceId),
      CheckListItemContent.create(content),
      now,
      now,
    );
  }

  /**
   * DBから取得したデータからチェック項目を復元する
   */
  static reconstruct(params: ReconstructCheckListItemParams): CheckListItem {
    return new CheckListItem(
      CheckListItemId.reconstruct(params.id),
      ReviewSpaceId.reconstruct(params.reviewSpaceId),
      CheckListItemContent.reconstruct(params.content),
      params.createdAt,
      params.updatedAt,
    );
  }

  /**
   * チェック項目内容を更新する
   * 新しいCheckListItemインスタンスを返す（不変性を保持）
   */
  updateContent(newContent: string): CheckListItem {
    return new CheckListItem(
      this._id,
      this._reviewSpaceId,
      CheckListItemContent.create(newContent),
      this._createdAt,
      new Date(),
    );
  }

  /**
   * DTOに変換する
   */
  toDto(): CheckListItemDto {
    return {
      id: this._id.value,
      reviewSpaceId: this._reviewSpaceId.value,
      content: this._content.value,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }

  /**
   * 一覧用DTOに変換する
   */
  toListItemDto(): CheckListItemListItemDto {
    return {
      id: this._id.value,
      content: this._content.value,
    };
  }

  // ゲッター
  get id(): CheckListItemId {
    return this._id;
  }

  get reviewSpaceId(): ReviewSpaceId {
    return this._reviewSpaceId;
  }

  get content(): CheckListItemContent {
    return this._content;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
