import { eq, sql, desc } from "drizzle-orm";
import {
  IQaHistoryRepository,
  FindQaHistoriesOptions,
  FindQaHistoriesResult,
} from "@/application/shared/port/repository/IQaHistoryRepository";
import { ReviewTargetId } from "@/domain/reviewTarget";
import {
  QaHistory,
  QaHistoryId,
  Question,
  Answer,
  QaStatus,
  ResearchSummary,
  CheckListItemContent,
} from "@/domain/qaHistory";
import { UserId } from "@/domain/user/UserId";
import { db } from "../index";
import { qaHistories } from "@/drizzle/schema";

/**
 * Q&A履歴リポジトリ実装
 * Drizzle ORMを使用してPostgreSQLと通信
 */
export class QaHistoryRepository implements IQaHistoryRepository {
  /**
   * IDでQ&A履歴を検索
   */
  async findById(id: QaHistoryId): Promise<QaHistory | null> {
    const result = await db
      .select()
      .from(qaHistories)
      .where(eq(qaHistories.id, id.value))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    return this.toEntity(result[0]);
  }

  /**
   * レビュー対象IDでQ&A履歴一覧を検索
   */
  async findByReviewTargetId(
    reviewTargetId: ReviewTargetId,
    options?: FindQaHistoriesOptions,
  ): Promise<FindQaHistoriesResult> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    // 総件数を取得
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(qaHistories)
      .where(eq(qaHistories.reviewTargetId, reviewTargetId.value));
    const total = Number(countResult[0]?.count ?? 0);

    // データを取得（作成日時の降順）
    const result = await db
      .select()
      .from(qaHistories)
      .where(eq(qaHistories.reviewTargetId, reviewTargetId.value))
      .orderBy(desc(qaHistories.createdAt))
      .limit(limit)
      .offset(offset);

    const items = result.map((row) => this.toEntity(row));

    return { items, total };
  }

  /**
   * Q&A履歴を保存（新規作成）
   */
  async save(qaHistory: QaHistory): Promise<void> {
    const data = {
      id: qaHistory.id.value,
      reviewTargetId: qaHistory.reviewTargetId.value,
      userId: qaHistory.userId.value,
      question: qaHistory.question.value,
      checkListItemContent: qaHistory.checkListItemContent.value,
      answer: qaHistory.answer?.value ?? null,
      researchSummary: qaHistory.researchSummary?.toJson() ?? null,
      status: qaHistory.status.value,
      errorMessage: qaHistory.errorMessage,
      createdAt: qaHistory.createdAt,
      updatedAt: qaHistory.updatedAt,
    };

    await db.insert(qaHistories).values(data);
  }

  /**
   * Q&A履歴の回答を更新（完了時）
   */
  async updateAnswer(
    id: QaHistoryId,
    answer: Answer,
    researchSummary: ResearchSummary,
  ): Promise<void> {
    await db
      .update(qaHistories)
      .set({
        answer: answer.value,
        researchSummary: researchSummary.toJson(),
        status: "completed",
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(qaHistories.id, id.value));
  }

  /**
   * Q&A履歴をエラー状態に更新
   */
  async updateError(id: QaHistoryId, errorMessage: string): Promise<void> {
    await db
      .update(qaHistories)
      .set({
        status: "error",
        errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(qaHistories.id, id.value));
  }

  /**
   * Q&A履歴のステータスを更新
   */
  async updateStatus(id: QaHistoryId, status: QaStatus): Promise<void> {
    await db
      .update(qaHistories)
      .set({
        status: status.value,
        updatedAt: new Date(),
      })
      .where(eq(qaHistories.id, id.value));
  }

  /**
   * Q&A履歴を削除
   */
  async delete(id: QaHistoryId): Promise<void> {
    await db.delete(qaHistories).where(eq(qaHistories.id, id.value));
  }

  /**
   * レビュー対象IDに紐づくQ&A履歴を全て削除
   */
  async deleteByReviewTargetId(reviewTargetId: ReviewTargetId): Promise<void> {
    await db
      .delete(qaHistories)
      .where(eq(qaHistories.reviewTargetId, reviewTargetId.value));
  }

  /**
   * DBレコードからエンティティに変換
   */
  private toEntity(row: typeof qaHistories.$inferSelect): QaHistory {
    return QaHistory.reconstruct({
      id: QaHistoryId.reconstruct(row.id),
      reviewTargetId: ReviewTargetId.reconstruct(row.reviewTargetId),
      userId: UserId.reconstruct(row.userId),
      question: Question.reconstruct(row.question),
      checkListItemContent: CheckListItemContent.reconstruct(
        row.checkListItemContent,
      ),
      answer: row.answer ? Answer.reconstruct(row.answer) : null,
      researchSummary: row.researchSummary
        ? ResearchSummary.fromJson(row.researchSummary)
        : null,
      status: QaStatus.create(row.status),
      errorMessage: row.errorMessage,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
