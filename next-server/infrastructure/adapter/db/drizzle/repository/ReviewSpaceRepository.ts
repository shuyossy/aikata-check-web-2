import { eq, desc, sql } from "drizzle-orm";
import {
  IReviewSpaceRepository,
  FindReviewSpacesOptions,
} from "@/application/shared/port/repository/IReviewSpaceRepository";
import { ProjectId } from "@/domain/project";
import {
  ReviewSpace,
  ReviewSpaceId,
  ReviewSettingsProps,
} from "@/domain/reviewSpace";
import { db } from "../index";
import { reviewSpaces } from "@/drizzle/schema";

/**
 * レビュースペースリポジトリ実装
 * Drizzle ORMを使用してPostgreSQLと通信
 */
export class ReviewSpaceRepository implements IReviewSpaceRepository {
  /**
   * IDでレビュースペースを検索
   */
  async findById(id: ReviewSpaceId): Promise<ReviewSpace | null> {
    const result = await db
      .select()
      .from(reviewSpaces)
      .where(eq(reviewSpaces.id, id.value))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return ReviewSpace.reconstruct({
      id: row.id,
      projectId: row.projectId,
      name: row.name,
      description: row.description,
      defaultReviewSettings: row.defaultReviewSettings as ReviewSettingsProps,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      checklistGenerationError: row.checklistGenerationError,
    });
  }

  /**
   * プロジェクトIDでレビュースペース一覧を検索
   */
  async findByProjectId(
    projectId: ProjectId,
    options?: FindReviewSpacesOptions,
  ): Promise<ReviewSpace[]> {
    const { search, limit = 100, offset = 0 } = options ?? {};

    // where句を構築
    const whereCondition = search
      ? sql`${reviewSpaces.projectId} = ${projectId.value} AND ${reviewSpaces.name} ILIKE ${"%" + search + "%"}`
      : eq(reviewSpaces.projectId, projectId.value);

    const result = await db
      .select()
      .from(reviewSpaces)
      .where(whereCondition)
      .orderBy(desc(reviewSpaces.updatedAt))
      .limit(limit)
      .offset(offset);

    return result.map((row) =>
      ReviewSpace.reconstruct({
        id: row.id,
        projectId: row.projectId,
        name: row.name,
        description: row.description,
        defaultReviewSettings: row.defaultReviewSettings as ReviewSettingsProps,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        checklistGenerationError: row.checklistGenerationError,
      }),
    );
  }

  /**
   * プロジェクトIDでレビュースペース数をカウント
   */
  async countByProjectId(
    projectId: ProjectId,
    search?: string,
  ): Promise<number> {
    const whereCondition = search
      ? sql`${reviewSpaces.projectId} = ${projectId.value} AND ${reviewSpaces.name} ILIKE ${"%" + search + "%"}`
      : eq(reviewSpaces.projectId, projectId.value);

    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(reviewSpaces)
      .where(whereCondition);

    return Number(result[0]?.count ?? 0);
  }

  /**
   * レビュースペースを保存（新規作成または更新）
   */
  async save(reviewSpace: ReviewSpace): Promise<void> {
    const data = {
      id: reviewSpace.id.value,
      projectId: reviewSpace.projectId.value,
      name: reviewSpace.name.value,
      description: reviewSpace.description.value,
      defaultReviewSettings: reviewSpace.defaultReviewSettings.toDto(),
      createdAt: reviewSpace.createdAt,
      updatedAt: reviewSpace.updatedAt,
    };

    await db
      .insert(reviewSpaces)
      .values(data)
      .onConflictDoUpdate({
        target: reviewSpaces.id,
        set: {
          name: data.name,
          description: data.description,
          defaultReviewSettings: data.defaultReviewSettings,
          updatedAt: data.updatedAt,
        },
      });
  }

  /**
   * レビュースペースを削除
   */
  async delete(id: ReviewSpaceId): Promise<void> {
    await db.delete(reviewSpaces).where(eq(reviewSpaces.id, id.value));
  }

  /**
   * チェックリスト生成エラーを更新
   */
  async updateChecklistGenerationError(
    id: ReviewSpaceId,
    errorMessage: string | null,
  ): Promise<void> {
    await db
      .update(reviewSpaces)
      .set({ checklistGenerationError: errorMessage })
      .where(eq(reviewSpaces.id, id.value));
  }
}
