import { eq, desc, sql, and } from "drizzle-orm";
import {
  IAiTaskRepository,
  FindAiTasksOptions,
} from "@/application/shared/port/repository/IAiTaskRepository";
import {
  AiTask,
  AiTaskId,
  AI_TASK_STATUS,
  AI_TASK_TYPE,
  type ReconstructAiTaskFileMetadataParams,
} from "@/domain/aiTask";
import { db } from "../index";
import { aiTasks, aiTaskFileMetadata } from "@/drizzle/schema";

/**
 * ファイルメタデータの行データ型
 */
type FileMetadataRow = typeof aiTaskFileMetadata.$inferSelect;

/**
 * AIタスクリポジトリ実装
 * Drizzle ORMを使用してPostgreSQLと通信
 */
export class AiTaskRepository implements IAiTaskRepository {
  /**
   * ファイルメタデータ行をドメインモデル再構築用のパラメータに変換する
   * 共通処理を集約することで保守性を向上
   */
  private static mapFileMetadataRows(
    fileMetadataRows: FileMetadataRow[],
  ): ReconstructAiTaskFileMetadataParams[] {
    return fileMetadataRows.map((fm) => ({
      id: fm.id,
      taskId: fm.taskId,
      fileName: fm.fileName,
      filePath: fm.filePath ?? "",
      fileSize: fm.fileSize,
      mimeType: fm.mimeType,
      processMode: (fm.processMode ?? "text") as "text" | "image",
      convertedImageCount: fm.convertedImageCount ?? 0,
      createdAt: fm.createdAt,
    }));
  }
  /**
   * IDでタスクを検索
   */
  async findById(id: AiTaskId): Promise<AiTask | null> {
    const result = await db
      .select()
      .from(aiTasks)
      .where(eq(aiTasks.id, id.value))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const row = result[0];

    // ファイルメタデータを取得
    const fileMetadataRows = await db
      .select()
      .from(aiTaskFileMetadata)
      .where(eq(aiTaskFileMetadata.taskId, row.id));

    return AiTask.reconstruct({
      id: row.id,
      taskType: row.taskType,
      status: row.status,
      apiKeyHash: row.apiKeyHash,
      priority: row.priority,
      payload: row.payload as Record<string, unknown>,
      errorMessage: row.errorMessage,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      fileMetadata: AiTaskRepository.mapFileMetadataRows(fileMetadataRows),
    });
  }

  /**
   * ステータスでタスクを検索
   */
  async findByStatus(
    status: string,
    options?: FindAiTasksOptions,
  ): Promise<AiTask[]> {
    const { limit = 100, offset = 0 } = options ?? {};

    const result = await db
      .select()
      .from(aiTasks)
      .where(eq(aiTasks.status, status))
      .orderBy(desc(aiTasks.createdAt))
      .limit(limit)
      .offset(offset);

    // 各タスクのファイルメタデータを取得
    const tasks: AiTask[] = [];
    for (const row of result) {
      const fileMetadataRows = await db
        .select()
        .from(aiTaskFileMetadata)
        .where(eq(aiTaskFileMetadata.taskId, row.id));

      tasks.push(
        AiTask.reconstruct({
          id: row.id,
          taskType: row.taskType,
          status: row.status,
          apiKeyHash: row.apiKeyHash,
          priority: row.priority,
          payload: row.payload as Record<string, unknown>,
          errorMessage: row.errorMessage,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          startedAt: row.startedAt,
          completedAt: row.completedAt,
          fileMetadata: AiTaskRepository.mapFileMetadataRows(fileMetadataRows),
        }),
      );
    }

    return tasks;
  }

  /**
   * APIキーハッシュとステータスでタスクを検索
   */
  async findByApiKeyHashAndStatus(
    apiKeyHash: string,
    status: string,
    options?: FindAiTasksOptions,
  ): Promise<AiTask[]> {
    const { limit = 100, offset = 0 } = options ?? {};

    const result = await db
      .select()
      .from(aiTasks)
      .where(
        and(eq(aiTasks.apiKeyHash, apiKeyHash), eq(aiTasks.status, status)),
      )
      .orderBy(desc(aiTasks.priority), aiTasks.createdAt)
      .limit(limit)
      .offset(offset);

    // 各タスクのファイルメタデータを取得
    const tasks: AiTask[] = [];
    for (const row of result) {
      const fileMetadataRows = await db
        .select()
        .from(aiTaskFileMetadata)
        .where(eq(aiTaskFileMetadata.taskId, row.id));

      tasks.push(
        AiTask.reconstruct({
          id: row.id,
          taskType: row.taskType,
          status: row.status,
          apiKeyHash: row.apiKeyHash,
          priority: row.priority,
          payload: row.payload as Record<string, unknown>,
          errorMessage: row.errorMessage,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          startedAt: row.startedAt,
          completedAt: row.completedAt,
          fileMetadata: AiTaskRepository.mapFileMetadataRows(fileMetadataRows),
        }),
      );
    }

    return tasks;
  }

  /**
   * キューにあるユニークなAPIキーハッシュ一覧を取得
   */
  async findDistinctApiKeyHashesInQueue(): Promise<string[]> {
    const result = await db
      .selectDistinct({ apiKeyHash: aiTasks.apiKeyHash })
      .from(aiTasks)
      .where(
        sql`${aiTasks.status} = ${AI_TASK_STATUS.QUEUED} OR ${aiTasks.status} = ${AI_TASK_STATUS.PROCESSING}`,
      );

    return result.map((row) => row.apiKeyHash);
  }

  /**
   * キュー長を取得
   */
  async countQueuedByApiKeyHash(apiKeyHash: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(aiTasks)
      .where(
        and(
          eq(aiTasks.apiKeyHash, apiKeyHash),
          eq(aiTasks.status, AI_TASK_STATUS.QUEUED),
        ),
      );

    return Number(result[0]?.count ?? 0);
  }

  /**
   * 次のタスクを取得して処理中に遷移（原子性保証）
   * SELECT FOR UPDATE SKIP LOCKEDを使用して排他制御
   * 優先度降順 → 作成日時昇順でソート
   */
  async dequeueNextTask(apiKeyHash: string): Promise<AiTask | null> {
    const now = new Date();

    // トランザクション内で排他的にタスクを取得して更新
    const result = await db.transaction(async (tx) => {
      // FOR UPDATE SKIP LOCKEDを使用して、他のワーカーがロック中の行をスキップ
      const taskRows = await tx.execute(sql`
        SELECT * FROM ${aiTasks}
        WHERE ${aiTasks.apiKeyHash} = ${apiKeyHash}
          AND ${aiTasks.status} = ${AI_TASK_STATUS.QUEUED}
        ORDER BY ${aiTasks.priority} DESC, ${aiTasks.createdAt} ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `);

      if (taskRows.rowCount === 0 || !taskRows.rows[0]) {
        return null;
      }

      const row = taskRows.rows[0] as {
        id: string;
        task_type: string;
        status: string;
        api_key_hash: string;
        priority: number;
        payload: Record<string, unknown>;
        error_message: string | null;
        created_at: Date;
        updated_at: Date;
        started_at: Date | null;
        completed_at: Date | null;
      };

      // 処理中に更新
      await tx
        .update(aiTasks)
        .set({
          status: AI_TASK_STATUS.PROCESSING,
          startedAt: now,
          updatedAt: now,
        })
        .where(eq(aiTasks.id, row.id));

      // ファイルメタデータを取得
      const fileMetadataRows = await tx
        .select()
        .from(aiTaskFileMetadata)
        .where(eq(aiTaskFileMetadata.taskId, row.id));

      return AiTask.reconstruct({
        id: row.id,
        taskType: row.task_type,
        status: AI_TASK_STATUS.PROCESSING, // 更新後のステータスを返す
        apiKeyHash: row.api_key_hash,
        priority: row.priority,
        payload: row.payload,
        errorMessage: row.error_message,
        createdAt: row.created_at,
        updatedAt: now,
        startedAt: now,
        completedAt: row.completed_at,
        fileMetadata: AiTaskRepository.mapFileMetadataRows(fileMetadataRows),
      });
    });

    return result;
  }

  /**
   * タスクを保存（新規作成または更新）
   */
  async save(task: AiTask): Promise<void> {
    const data = {
      id: task.id.value,
      taskType: task.taskType.value,
      status: task.status.value,
      apiKeyHash: task.apiKeyHash,
      priority: task.priority.value,
      payload: task.payload,
      errorMessage: task.errorMessage,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
    };

    await db.transaction(async (tx) => {
      // タスク本体を保存
      await tx
        .insert(aiTasks)
        .values(data)
        .onConflictDoUpdate({
          target: aiTasks.id,
          set: {
            taskType: data.taskType,
            status: data.status,
            priority: data.priority,
            payload: data.payload,
            errorMessage: data.errorMessage,
            updatedAt: data.updatedAt,
            startedAt: data.startedAt,
            completedAt: data.completedAt,
          },
        });

      // ファイルメタデータを保存
      for (const fm of task.fileMetadata) {
        const fmData = {
          id: fm.id.value,
          taskId: task.id.value, // タスクIDを設定
          fileName: fm.fileName,
          filePath: fm.filePath || null,
          fileSize: fm.fileSize,
          mimeType: fm.mimeType,
          processMode: fm.processMode,
          convertedImageCount: fm.convertedImageCount,
          createdAt: fm.createdAt,
        };

        await tx
          .insert(aiTaskFileMetadata)
          .values(fmData)
          .onConflictDoUpdate({
            target: aiTaskFileMetadata.id,
            set: {
              fileName: fmData.fileName,
              filePath: fmData.filePath,
              processMode: fmData.processMode,
              convertedImageCount: fmData.convertedImageCount,
            },
          });
      }
    });
  }

  /**
   * タスクを削除
   */
  async delete(id: AiTaskId): Promise<void> {
    // CASCADE設定により、ファイルメタデータも自動削除される
    await db.delete(aiTasks).where(eq(aiTasks.id, id.value));
  }

  /**
   * ステータスでタスクを削除
   */
  async deleteByStatus(status: string): Promise<void> {
    await db.delete(aiTasks).where(eq(aiTasks.status, status));
  }

  /**
   * レビュー対象IDでタスクを検索
   * ペイロードのreviewTargetIdが一致するタスク（キュー待機中/処理中）を取得する
   */
  async findByReviewTargetId(reviewTargetId: string): Promise<AiTask | null> {
    const result = await db
      .select()
      .from(aiTasks)
      .where(
        and(
          sql`${aiTasks.payload}->>'reviewTargetId' = ${reviewTargetId}`,
          sql`${aiTasks.status} IN (${AI_TASK_STATUS.QUEUED}, ${AI_TASK_STATUS.PROCESSING})`,
        ),
      )
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const row = result[0];

    // ファイルメタデータを取得
    const fileMetadataRows = await db
      .select()
      .from(aiTaskFileMetadata)
      .where(eq(aiTaskFileMetadata.taskId, row.id));

    return AiTask.reconstruct({
      id: row.id,
      taskType: row.taskType,
      status: row.status,
      apiKeyHash: row.apiKeyHash,
      priority: row.priority,
      payload: row.payload as Record<string, unknown>,
      errorMessage: row.errorMessage,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      fileMetadata: AiTaskRepository.mapFileMetadataRows(fileMetadataRows),
    });
  }

  /**
   * レビュー対象IDでタスクを削除
   * ペイロードのreviewTargetIdが一致するタスクを削除する
   */
  async deleteByReviewTargetId(reviewTargetId: string): Promise<void> {
    await db
      .delete(aiTasks)
      .where(sql`${aiTasks.payload}->>'reviewTargetId' = ${reviewTargetId}`);
  }

  /**
   * レビュースペースIDでチェックリスト生成タスクを検索
   * キュー待機中または処理中のタスクのみを対象とする
   */
  async findChecklistGenerationTaskByReviewSpaceId(
    reviewSpaceId: string,
  ): Promise<AiTask | null> {
    const result = await db
      .select()
      .from(aiTasks)
      .where(
        and(
          eq(aiTasks.taskType, AI_TASK_TYPE.CHECKLIST_GENERATION),
          sql`${aiTasks.payload}->>'reviewSpaceId' = ${reviewSpaceId}`,
          sql`${aiTasks.status} IN (${AI_TASK_STATUS.QUEUED}, ${AI_TASK_STATUS.PROCESSING})`,
        ),
      )
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const row = result[0];

    // ファイルメタデータを取得
    const fileMetadataRows = await db
      .select()
      .from(aiTaskFileMetadata)
      .where(eq(aiTaskFileMetadata.taskId, row.id));

    return AiTask.reconstruct({
      id: row.id,
      taskType: row.taskType,
      status: row.status,
      apiKeyHash: row.apiKeyHash,
      priority: row.priority,
      payload: row.payload as Record<string, unknown>,
      errorMessage: row.errorMessage,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      fileMetadata: AiTaskRepository.mapFileMetadataRows(fileMetadataRows),
    });
  }

  /**
   * レビュースペースIDでチェックリスト生成タスクを削除
   * ペイロードのreviewSpaceIdが一致するチェックリスト生成タスクを削除する
   */
  async deleteChecklistGenerationTaskByReviewSpaceId(
    reviewSpaceId: string,
  ): Promise<void> {
    await db
      .delete(aiTasks)
      .where(
        and(
          eq(aiTasks.taskType, AI_TASK_TYPE.CHECKLIST_GENERATION),
          sql`${aiTasks.payload}->>'reviewSpaceId' = ${reviewSpaceId}`,
        ),
      );
  }
}
