import {
  AiTaskFileMetadata,
  AiTaskFileMetadataId,
  AiTaskId,
} from "@/domain/aiTask";

/**
 * AIタスクファイルメタデータリポジトリインターフェース
 */
export interface IAiTaskFileMetadataRepository {
  /**
   * IDでファイルメタデータを検索
   * @param id ファイルメタデータID
   * @returns ファイルメタデータエンティティ（存在しない場合はnull）
   */
  findById(id: AiTaskFileMetadataId): Promise<AiTaskFileMetadata | null>;

  /**
   * タスクIDでファイルメタデータを検索
   * @param taskId タスクID
   * @returns ファイルメタデータエンティティの配列
   */
  findByTaskId(taskId: AiTaskId): Promise<AiTaskFileMetadata[]>;

  /**
   * ファイルメタデータを保存（新規作成または更新）
   * @param metadata ファイルメタデータエンティティ
   */
  save(metadata: AiTaskFileMetadata): Promise<void>;

  /**
   * 複数のファイルメタデータを一括保存
   * @param metadataList ファイルメタデータエンティティの配列
   */
  saveMany(metadataList: AiTaskFileMetadata[]): Promise<void>;

  /**
   * ファイルメタデータを削除
   * @param id ファイルメタデータID
   */
  delete(id: AiTaskFileMetadataId): Promise<void>;

  /**
   * タスクIDでファイルメタデータを削除
   * @param taskId タスクID
   */
  deleteByTaskId(taskId: AiTaskId): Promise<void>;
}
