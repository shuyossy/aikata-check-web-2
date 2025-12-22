/**
 * ワークフロー実行管理レジストリ
 *
 * 実行中のMastraワークフローを追跡し、必要に応じてキャンセルできるようにする。
 * シングルトンパターンで実装され、アプリケーション全体で共有される。
 */

import { getLogger } from "@/lib/server/logger";

// MastraのWorkflowRun型に対応する簡易インターフェース
// Mastra内部の型に依存しないよう、必要なメソッドのみ定義
export interface CancellableWorkflowRun {
  cancel(): Promise<void>;
}

/**
 * ワークフロー実行レジストリのインターフェース
 */
export interface IWorkflowRunRegistry {
  /**
   * ワークフロー実行を登録する
   * @param taskId AIタスクID
   * @param run ワークフロー実行インスタンス
   */
  register(taskId: string, run: CancellableWorkflowRun): void;

  /**
   * ワークフロー実行の登録を解除する
   * @param taskId AIタスクID
   */
  deregister(taskId: string): void;

  /**
   * 指定されたタスクのワークフローをキャンセルする
   * @param taskId AIタスクID
   * @returns キャンセルが成功したかどうか（登録されていない場合はfalse）
   */
  cancel(taskId: string): Promise<boolean>;

  /**
   * 指定されたタスクのワークフローが登録されているか確認する
   * @param taskId AIタスクID
   */
  isRegistered(taskId: string): boolean;

  /**
   * 現在キャンセル処理中かどうかを返す
   */
  isCancelling(): boolean;

  /**
   * キャンセル中フラグを設定する
   * @param value フラグ値
   */
  setCancelling(value: boolean): void;
}

const logger = getLogger();

/**
 * ワークフロー実行レジストリの実装
 *
 * シングルトンパターンで実装。
 * - 実行中のワークフローをタスクIDで追跡
 * - キャンセル中フラグで新規デキューをブロック
 */
export class WorkflowRunRegistry implements IWorkflowRunRegistry {
  private static instance: WorkflowRunRegistry | null = null;

  private runs: Map<string, CancellableWorkflowRun> = new Map();
  private _isCancelling: boolean = false;

  // テスト用にコンストラクタを公開
  constructor() {}

  /**
   * シングルトンインスタンスを取得する
   */
  static getInstance(): WorkflowRunRegistry {
    if (!WorkflowRunRegistry.instance) {
      WorkflowRunRegistry.instance = new WorkflowRunRegistry();
    }
    return WorkflowRunRegistry.instance;
  }

  /**
   * シングルトンインスタンスをリセットする（テスト用）
   */
  static resetInstance(): void {
    WorkflowRunRegistry.instance = null;
  }

  /**
   * ワークフロー実行を登録する
   */
  register(taskId: string, run: CancellableWorkflowRun): void {
    this.runs.set(taskId, run);
    logger.debug({ taskId }, "ワークフロー実行を登録しました");
  }

  /**
   * ワークフロー実行の登録を解除する
   */
  deregister(taskId: string): void {
    const deleted = this.runs.delete(taskId);
    if (deleted) {
      logger.debug({ taskId }, "ワークフロー実行の登録を解除しました");
    }
  }

  /**
   * 指定されたタスクのワークフローをキャンセルする
   */
  async cancel(taskId: string): Promise<boolean> {
    const run = this.runs.get(taskId);
    if (!run) {
      logger.debug(
        { taskId },
        "キャンセル対象のワークフロー実行が見つかりません",
      );
      return false;
    }

    try {
      logger.info({ taskId }, "ワークフローのキャンセルを開始します");
      await run.cancel();
      this.runs.delete(taskId);
      logger.info({ taskId }, "ワークフローのキャンセルが完了しました");
      return true;
    } catch (error) {
      logger.warn(
        { err: error, taskId },
        "ワークフローのキャンセルに失敗しました",
      );
      // キャンセル失敗でも登録は解除する
      this.runs.delete(taskId);
      return false;
    }
  }

  /**
   * 指定されたタスクのワークフローが登録されているか確認する
   */
  isRegistered(taskId: string): boolean {
    return this.runs.has(taskId);
  }

  /**
   * 現在キャンセル処理中かどうかを返す
   */
  isCancelling(): boolean {
    return this._isCancelling;
  }

  /**
   * キャンセル中フラグを設定する
   */
  setCancelling(value: boolean): void {
    this._isCancelling = value;
    logger.debug({ isCancelling: value }, "キャンセル中フラグを更新しました");
  }

  /**
   * 登録されているワークフロー実行数を返す（テスト・デバッグ用）
   */
  size(): number {
    return this.runs.size;
  }

  /**
   * 全てのワークフロー実行をクリアする（テスト用）
   */
  clear(): void {
    this.runs.clear();
    this._isCancelling = false;
  }
}
