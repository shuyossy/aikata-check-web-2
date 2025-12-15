import { eq } from "drizzle-orm";
import { IAiTaskFileMetadataRepository } from "@/application/shared/port/repository/IAiTaskFileMetadataRepository";
import {
  AiTaskFileMetadata,
  AiTaskFileMetadataId,
  AiTaskId,
} from "@/domain/aiTask";
import { db } from "../index";
import { aiTaskFileMetadata } from "@/drizzle/schema";

/**
 * AIタスクファイルメタデータリポジトリ実装
 * Drizzle ORMを使用してPostgreSQLと通信
 */
export class AiTaskFileMetadataRepository
  implements IAiTaskFileMetadataRepository
{
  /**
   * IDでファイルメタデータを検索
   */
  async findById(
    id: AiTaskFileMetadataId,
  ): Promise<AiTaskFileMetadata | null> {
    const result = await db
      .select()
      .from(aiTaskFileMetadata)
      .where(eq(aiTaskFileMetadata.id, id.value))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return AiTaskFileMetadata.reconstruct({
      id: row.id,
      taskId: row.taskId,
      fileName: row.fileName,
      filePath: row.filePath ?? "",
      fileSize: row.fileSize,
      mimeType: row.mimeType,
      processMode: (row.processMode ?? "text") as "text" | "image",
      convertedImageCount: row.convertedImageCount ?? 0,
      createdAt: row.createdAt,
    });
  }

  /**
   * タスクIDでファイルメタデータを検索
   */
  async findByTaskId(taskId: AiTaskId): Promise<AiTaskFileMetadata[]> {
    const result = await db
      .select()
      .from(aiTaskFileMetadata)
      .where(eq(aiTaskFileMetadata.taskId, taskId.value));

    return result.map((row) =>
      AiTaskFileMetadata.reconstruct({
        id: row.id,
        taskId: row.taskId,
        fileName: row.fileName,
        filePath: row.filePath ?? "",
        fileSize: row.fileSize,
        mimeType: row.mimeType,
        processMode: (row.processMode ?? "text") as "text" | "image",
        convertedImageCount: row.convertedImageCount ?? 0,
        createdAt: row.createdAt,
      }),
    );
  }

  /**
   * ファイルメタデータを保存（新規作成または更新）
   */
  async save(metadata: AiTaskFileMetadata): Promise<void> {
    if (!metadata.taskId) {
      throw new Error(
        "taskId is required to save AiTaskFileMetadata",
      );
    }

    const data = {
      id: metadata.id.value,
      taskId: metadata.taskId.value,
      fileName: metadata.fileName,
      filePath: metadata.filePath || null,
      fileSize: metadata.fileSize,
      mimeType: metadata.mimeType,
      processMode: metadata.processMode,
      convertedImageCount: metadata.convertedImageCount,
      createdAt: metadata.createdAt,
    };

    await db
      .insert(aiTaskFileMetadata)
      .values(data)
      .onConflictDoUpdate({
        target: aiTaskFileMetadata.id,
        set: {
          fileName: data.fileName,
          filePath: data.filePath,
          processMode: data.processMode,
          convertedImageCount: data.convertedImageCount,
        },
      });
  }

  /**
   * 複数のファイルメタデータを一括保存
   */
  async saveMany(metadataList: AiTaskFileMetadata[]): Promise<void> {
    if (metadataList.length === 0) {
      return;
    }

    for (const metadata of metadataList) {
      await this.save(metadata);
    }
  }

  /**
   * ファイルメタデータを削除
   */
  async delete(id: AiTaskFileMetadataId): Promise<void> {
    await db
      .delete(aiTaskFileMetadata)
      .where(eq(aiTaskFileMetadata.id, id.value));
  }

  /**
   * タスクIDでファイルメタデータを削除
   */
  async deleteByTaskId(taskId: AiTaskId): Promise<void> {
    await db
      .delete(aiTaskFileMetadata)
      .where(eq(aiTaskFileMetadata.taskId, taskId.value));
  }
}
