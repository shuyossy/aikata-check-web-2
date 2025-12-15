import { AiTask, AiTaskId } from "@/domain/aiTask";

/**
 * AIタスク検索オプション
 */
export interface FindAiTasksOptions {
  /** 取得件数上限 */
  limit?: number;
  /** オフセット */
  offset?: number;
  /** ステータスでフィルタ */
  status?: string;
}

/**
 * AIタスクリポジトリインターフェース
 */
export interface IAiTaskRepository {
  /**
   * IDでタスクを検索
   * @param id タスクID
   * @returns タスクエンティティ（存在しない場合はnull）
   */
  findById(id: AiTaskId): Promise<AiTask | null>;

  /**
   * ステータスでタスクを検索
   * @param status ステータス
   * @param options 検索オプション
   * @returns タスクエンティティの配列
   */
  findByStatus(status: string, options?: FindAiTasksOptions): Promise<AiTask[]>;

  /**
   * APIキーハッシュとステータスでタスクを検索
   * @param apiKeyHash APIキーハッシュ
   * @param status ステータス
   * @param options 検索オプション
   * @returns タスクエンティティの配列
   */
  findByApiKeyHashAndStatus(
    apiKeyHash: string,
    status: string,
    options?: FindAiTasksOptions,
  ): Promise<AiTask[]>;

  /**
   * キューにあるユニークなAPIキーハッシュ一覧を取得
   * @returns APIキーハッシュの配列
   */
  findDistinctApiKeyHashesInQueue(): Promise<string[]>;

  /**
   * キュー長を取得
   * @param apiKeyHash APIキーハッシュ
   * @returns キュー待機中のタスク数
   */
  countQueuedByApiKeyHash(apiKeyHash: string): Promise<number>;

  /**
   * 次のタスクを取得して処理中に遷移（原子性保証）
   * SELECT FOR UPDATE SKIP LOCKEDを使用して排他制御
   * @param apiKeyHash APIキーハッシュ
   * @returns タスクエンティティ（キューが空の場合はnull）
   */
  dequeueNextTask(apiKeyHash: string): Promise<AiTask | null>;

  /**
   * タスクを保存（新規作成または更新）
   * @param task タスクエンティティ
   */
  save(task: AiTask): Promise<void>;

  /**
   * タスクを削除
   * @param id タスクID
   */
  delete(id: AiTaskId): Promise<void>;

  /**
   * ステータスでタスクを削除
   * @param status ステータス
   */
  deleteByStatus(status: string): Promise<void>;

  /**
   * レビュー対象IDでタスクを検索
   * ペイロードのreviewTargetIdが一致するタスク（キュー待機中/処理中）を取得する
   * @param reviewTargetId レビュー対象ID
   * @returns タスクエンティティ（存在しない場合はnull）
   */
  findByReviewTargetId(reviewTargetId: string): Promise<AiTask | null>;

  /**
   * レビュー対象IDでタスクを削除
   * ペイロードのreviewTargetIdが一致するタスクを削除する
   * @param reviewTargetId レビュー対象ID
   */
  deleteByReviewTargetId(reviewTargetId: string): Promise<void>;

  /**
   * レビュースペースIDでチェックリスト生成タスクを検索
   * キュー待機中または処理中のタスクのみを対象とする
   * @param reviewSpaceId レビュースペースID
   * @returns タスクエンティティ（存在しない場合はnull）
   */
  findChecklistGenerationTaskByReviewSpaceId(
    reviewSpaceId: string,
  ): Promise<AiTask | null>;

  /**
   * レビュースペースIDでチェックリスト生成タスクを削除
   * ペイロードのreviewSpaceIdが一致するチェックリスト生成タスクを削除する
   * @param reviewSpaceId レビュースペースID
   */
  deleteChecklistGenerationTaskByReviewSpaceId(
    reviewSpaceId: string,
  ): Promise<void>;
}
