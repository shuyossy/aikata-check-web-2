import { QaHistoryId } from "./QaHistoryId";
import { Question } from "./Question";
import { Answer } from "./Answer";
import { QaStatus } from "./QaStatus";
import { ResearchSummary } from "./ResearchSummary";
import { CheckListItemContent } from "./CheckListItemContent";
import { ReviewTargetId } from "../reviewTarget/ReviewTargetId";
import { UserId } from "../user/UserId";

/**
 * Q&A履歴エンティティ
 * レビュー結果に対するQ&Aの履歴を表す
 */
export class QaHistory {
  private constructor(
    private readonly _id: QaHistoryId,
    private readonly _reviewTargetId: ReviewTargetId,
    private readonly _userId: UserId,
    private readonly _question: Question,
    private readonly _checkListItemContent: CheckListItemContent,
    private _answer: Answer | null,
    private _researchSummary: ResearchSummary | null,
    private _status: QaStatus,
    private _errorMessage: string | null,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {}

  /**
   * 新規Q&A履歴を作成する（保留中ステータス）
   * SSE接続確立後にワークフローが開始される
   */
  static create(params: {
    reviewTargetId: ReviewTargetId;
    userId: UserId;
    question: Question;
    checkListItemContent: CheckListItemContent;
  }): QaHistory {
    const now = new Date();
    return new QaHistory(
      QaHistoryId.create(),
      params.reviewTargetId,
      params.userId,
      params.question,
      params.checkListItemContent,
      null,
      null,
      QaStatus.pending(),
      null,
      now,
      now,
    );
  }

  /**
   * 既存データから復元する（DBから読み込み時など）
   */
  static reconstruct(params: {
    id: QaHistoryId;
    reviewTargetId: ReviewTargetId;
    userId: UserId;
    question: Question;
    checkListItemContent: CheckListItemContent;
    answer: Answer | null;
    researchSummary: ResearchSummary | null;
    status: QaStatus;
    errorMessage: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): QaHistory {
    return new QaHistory(
      params.id,
      params.reviewTargetId,
      params.userId,
      params.question,
      params.checkListItemContent,
      params.answer,
      params.researchSummary,
      params.status,
      params.errorMessage,
      params.createdAt,
      params.updatedAt,
    );
  }

  /**
   * 処理を開始する（pending → processing）
   * @throws pending状態でない場合はエラー
   */
  startProcessing(): void {
    if (!this._status.isPending()) {
      throw new Error("処理を開始できるのはpending状態のときのみです");
    }
    this._status = QaStatus.processing();
    this._updatedAt = new Date();
  }

  /**
   * 回答を設定して完了状態にする
   */
  complete(answer: Answer, researchSummary: ResearchSummary): void {
    this._answer = answer;
    this._researchSummary = researchSummary;
    this._status = QaStatus.completed();
    this._errorMessage = null;
    this._updatedAt = new Date();
  }

  /**
   * エラー状態にする
   */
  fail(errorMessage: string): void {
    this._status = QaStatus.error();
    this._errorMessage = errorMessage;
    this._updatedAt = new Date();
  }

  // ======== Getters ========

  get id(): QaHistoryId {
    return this._id;
  }

  get reviewTargetId(): ReviewTargetId {
    return this._reviewTargetId;
  }

  get userId(): UserId {
    return this._userId;
  }

  get question(): Question {
    return this._question;
  }

  get checkListItemContent(): CheckListItemContent {
    return this._checkListItemContent;
  }

  get answer(): Answer | null {
    return this._answer;
  }

  get researchSummary(): ResearchSummary | null {
    return this._researchSummary;
  }

  get status(): QaStatus {
    return this._status;
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

  // ======== Query methods ========

  /**
   * 保留中かどうか（ワークフロー開始待ち）
   */
  isPending(): boolean {
    return this._status.isPending();
  }

  /**
   * 処理中かどうか
   */
  isProcessing(): boolean {
    return this._status.isProcessing();
  }

  /**
   * 完了かどうか
   */
  isCompleted(): boolean {
    return this._status.isCompleted();
  }

  /**
   * エラーかどうか
   */
  isError(): boolean {
    return this._status.isError();
  }

  /**
   * 等価性の比較（IDによる比較）
   */
  equals(other: QaHistory): boolean {
    return this._id.equals(other._id);
  }
}
