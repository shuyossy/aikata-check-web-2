import { domainValidationError } from "@/lib/server/error";
import { EvaluationCriteria, DEFAULT_EVALUATION_CRITERIA } from "./EvaluationCriteria";
import { EvaluationItemProps } from "./EvaluationItem";

/**
 * 同時レビュー項目数のデフォルト値
 */
export const DEFAULT_CONCURRENT_REVIEW_ITEMS = 1;

/**
 * コメントフォーマットのデフォルト値
 */
export const DEFAULT_COMMENT_FORMAT = `【評価理由・根拠】
（具体的な理由と根拠を記載）

【改善提案】
（改善のための具体的な提案を記載）`;

/**
 * レビュー設定のプロパティ
 */
export interface ReviewSettingsProps {
  additionalInstructions?: string | null;
  concurrentReviewItems?: number | null;
  commentFormat?: string | null;
  evaluationCriteria?: EvaluationItemProps[] | null;
}

/**
 * レビュー設定のDTO
 */
export interface ReviewSettingsDto {
  additionalInstructions: string | null;
  concurrentReviewItems: number;
  commentFormat: string;
  evaluationCriteria: EvaluationItemProps[];
}

/**
 * レビュー設定値オブジェクト
 * レビュー実行時の各種設定を管理
 */
export class ReviewSettings {
  private static readonly MAX_ADDITIONAL_INSTRUCTIONS_LENGTH = 2000;
  private static readonly MIN_CONCURRENT_ITEMS = 1;
  private static readonly MAX_CONCURRENT_ITEMS = 100;
  private static readonly MAX_COMMENT_FORMAT_LENGTH = 2000;

  private readonly _additionalInstructions: string | null;
  private readonly _concurrentReviewItems: number;
  private readonly _commentFormat: string;
  private readonly _evaluationCriteria: EvaluationCriteria;

  private constructor(
    additionalInstructions: string | null,
    concurrentReviewItems: number,
    commentFormat: string,
    evaluationCriteria: EvaluationCriteria,
  ) {
    this._additionalInstructions = additionalInstructions;
    this._concurrentReviewItems = concurrentReviewItems;
    this._commentFormat = commentFormat;
    this._evaluationCriteria = evaluationCriteria;
  }

  /**
   * 新規レビュー設定を生成する
   * @throws ドメインバリデーションエラー - 設定値が不正な場合
   */
  static create(props: ReviewSettingsProps): ReviewSettings {
    const additionalInstructions = props.additionalInstructions ?? null;
    // 必須フィールドはデフォルト値を使用
    const concurrentReviewItems = props.concurrentReviewItems ?? DEFAULT_CONCURRENT_REVIEW_ITEMS;
    const commentFormat = props.commentFormat ?? DEFAULT_COMMENT_FORMAT;
    const evaluationCriteria = props.evaluationCriteria ?? DEFAULT_EVALUATION_CRITERIA;

    // バリデーション
    ReviewSettings.validateAdditionalInstructions(additionalInstructions);
    ReviewSettings.validateConcurrentReviewItems(concurrentReviewItems);
    ReviewSettings.validateCommentFormat(commentFormat);

    // 評定基準の生成
    const criteria = EvaluationCriteria.create(evaluationCriteria);

    return new ReviewSettings(
      additionalInstructions,
      concurrentReviewItems,
      commentFormat,
      criteria,
    );
  }

  /**
   * デフォルトのレビュー設定を生成する
   * 同時レビュー項目数、コメントフォーマット、評定基準にデフォルト値を設定
   */
  static createDefault(): ReviewSettings {
    return new ReviewSettings(
      null, // additionalInstructions
      DEFAULT_CONCURRENT_REVIEW_ITEMS,
      DEFAULT_COMMENT_FORMAT,
      EvaluationCriteria.create(DEFAULT_EVALUATION_CRITERIA),
    );
  }

  /**
   * 既存データから復元する
   * DBからの復元時に使用（バリデーション済みのため検証なし）
   */
  static reconstruct(props: ReviewSettingsProps): ReviewSettings {
    const additionalInstructions = props.additionalInstructions ?? null;
    // 必須フィールドはデフォルト値を使用（既存データの互換性のため）
    const concurrentReviewItems = props.concurrentReviewItems ?? DEFAULT_CONCURRENT_REVIEW_ITEMS;
    const commentFormat = props.commentFormat ?? DEFAULT_COMMENT_FORMAT;
    const evaluationCriteria = props.evaluationCriteria ?? DEFAULT_EVALUATION_CRITERIA;

    const criteria = EvaluationCriteria.reconstruct(evaluationCriteria);

    return new ReviewSettings(
      additionalInstructions,
      concurrentReviewItems,
      commentFormat,
      criteria,
    );
  }

  /**
   * 追加指示の検証
   */
  private static validateAdditionalInstructions(value: string | null): void {
    if (value !== null && value.length > ReviewSettings.MAX_ADDITIONAL_INSTRUCTIONS_LENGTH) {
      throw domainValidationError("REVIEW_SETTINGS_ADDITIONAL_INSTRUCTIONS_TOO_LONG");
    }
  }

  /**
   * 同時レビュー項目数の検証
   */
  private static validateConcurrentReviewItems(value: number): void {
    if (
      value < ReviewSettings.MIN_CONCURRENT_ITEMS ||
      value > ReviewSettings.MAX_CONCURRENT_ITEMS
    ) {
      throw domainValidationError("REVIEW_SETTINGS_CONCURRENT_ITEMS_INVALID");
    }
  }

  /**
   * コメントフォーマットの検証
   */
  private static validateCommentFormat(value: string): void {
    if (value.length === 0) {
      throw domainValidationError("REVIEW_SETTINGS_COMMENT_FORMAT_REQUIRED");
    }
    if (value.length > ReviewSettings.MAX_COMMENT_FORMAT_LENGTH) {
      throw domainValidationError("REVIEW_SETTINGS_COMMENT_FORMAT_TOO_LONG");
    }
  }

  /**
   * 追加指示を取得
   */
  get additionalInstructions(): string | null {
    return this._additionalInstructions;
  }

  /**
   * 同時レビュー項目数を取得
   */
  get concurrentReviewItems(): number {
    return this._concurrentReviewItems;
  }

  /**
   * コメントフォーマットを取得
   */
  get commentFormat(): string {
    return this._commentFormat;
  }

  /**
   * 評定基準を取得
   */
  get evaluationCriteria(): EvaluationCriteria {
    return this._evaluationCriteria;
  }

  /**
   * DTOに変換する
   */
  toDto(): ReviewSettingsDto {
    return {
      additionalInstructions: this._additionalInstructions,
      concurrentReviewItems: this._concurrentReviewItems,
      commentFormat: this._commentFormat,
      evaluationCriteria: this._evaluationCriteria.toJSON(),
    };
  }

  /**
   * 等価性の比較
   */
  equals(other: ReviewSettings): boolean {
    // 単純プロパティの比較
    if (this._additionalInstructions !== other._additionalInstructions) return false;
    if (this._concurrentReviewItems !== other._concurrentReviewItems) return false;
    if (this._commentFormat !== other._commentFormat) return false;

    // 評定基準の比較
    return this._evaluationCriteria.equals(other._evaluationCriteria);
  }
}
