/**
 * レビュー対象クリーンアップヘルパー
 *
 * プロジェクト削除・レビュースペース削除時に共通で利用される
 * レビュー対象とAIタスクのクリーンアップ処理を提供する。
 */

import { IAiTaskRepository } from "@/application/shared/port/repository";
import { IReviewTargetRepository } from "@/application/shared/port/repository/IReviewTargetRepository";
import { type IWorkflowRunRegistry } from "@/application/aiTask/WorkflowRunRegistry";
import { ReviewSpaceId } from "@/domain/reviewSpace";
import { TaskFileHelper } from "@/lib/server/taskFileHelper";
import { ReviewCacheHelper } from "@/lib/server/reviewCacheHelper";
import { getLogger } from "@/lib/server/logger";

const logger = getLogger();

/**
 * レビュー対象クリーンアップヘルパー
 */
export class ReviewTargetCleanupHelper {
  constructor(
    private readonly reviewTargetRepository: IReviewTargetRepository,
    private readonly aiTaskRepository: IAiTaskRepository,
    private readonly workflowRunRegistry?: IWorkflowRunRegistry,
  ) {}

  /**
   * レビュースペース内の全レビュー対象をクリーンアップする
   * @param reviewSpaceId レビュースペースID
   */
  async cleanupReviewTargets(reviewSpaceId: string): Promise<void> {
    const reviewSpaceIdVo = ReviewSpaceId.reconstruct(reviewSpaceId);
    const reviewTargets =
      await this.reviewTargetRepository.findByReviewSpaceId(reviewSpaceIdVo);

    for (const reviewTarget of reviewTargets) {
      await this.cleanupSingleReviewTarget(reviewTarget.id.value);
    }
  }

  /**
   * 単一のレビュー対象をクリーンアップする
   * @param reviewTargetId レビュー対象ID
   */
  async cleanupSingleReviewTarget(reviewTargetId: string): Promise<void> {
    // AIタスクの検索と処理
    const aiTask =
      await this.aiTaskRepository.findByReviewTargetId(reviewTargetId);

    if (aiTask) {
      const taskId = aiTask.id.value;

      // PROCESSING状態の場合、ワークフローをキャンセル
      if (aiTask.status.value === "processing" && this.workflowRunRegistry) {
        await this.cancelWorkflow(taskId, reviewTargetId);
      }

      // タスクファイルの削除
      await this.deleteTaskFiles(taskId, reviewTargetId);

      // AIタスクの削除
      await this.aiTaskRepository.deleteByReviewTargetId(reviewTargetId);
    }

    // キャッシュディレクトリの削除
    await this.deleteCacheDirectory(reviewTargetId);
  }

  /**
   * チェックリスト生成タスクをクリーンアップする
   * @param reviewSpaceId レビュースペースID
   */
  async cleanupChecklistGenerationTask(reviewSpaceId: string): Promise<void> {
    const checklistTask =
      await this.aiTaskRepository.findChecklistGenerationTaskByReviewSpaceId(
        reviewSpaceId,
      );

    if (checklistTask) {
      const taskId = checklistTask.id.value;

      // PROCESSING状態の場合、ワークフローをキャンセル
      if (
        checklistTask.status.value === "processing" &&
        this.workflowRunRegistry
      ) {
        await this.cancelChecklistWorkflow(taskId, reviewSpaceId);
      }

      // タスクファイルの削除
      await this.deleteChecklistTaskFiles(taskId, reviewSpaceId);

      // チェックリスト生成タスクの削除
      await this.aiTaskRepository.deleteChecklistGenerationTaskByReviewSpaceId(
        reviewSpaceId,
      );
    }
  }

  /**
   * ワークフローをキャンセルする
   */
  private async cancelWorkflow(
    taskId: string,
    reviewTargetId: string,
  ): Promise<void> {
    if (!this.workflowRunRegistry) {
      return;
    }

    try {
      this.workflowRunRegistry.setCancelling(true);

      logger.info(
        { taskId, reviewTargetId },
        "ワークフローのキャンセルを開始します",
      );

      const cancelled = await this.workflowRunRegistry.cancel(taskId);
      if (cancelled) {
        logger.info(
          { taskId, reviewTargetId },
          "ワークフローのキャンセルが完了しました",
        );
      } else {
        logger.warn(
          { taskId, reviewTargetId },
          "ワークフローのキャンセルに失敗しました（ワークフロー実行が見つからない可能性があります）",
        );
      }
    } catch (error) {
      logger.warn(
        { err: error, taskId, reviewTargetId },
        "ワークフローのキャンセル中にエラーが発生しました（削除処理は続行します）",
      );
    } finally {
      this.workflowRunRegistry.setCancelling(false);
    }
  }

  /**
   * チェックリスト生成ワークフローをキャンセルする
   */
  private async cancelChecklistWorkflow(
    taskId: string,
    reviewSpaceId: string,
  ): Promise<void> {
    if (!this.workflowRunRegistry) {
      return;
    }

    try {
      this.workflowRunRegistry.setCancelling(true);

      logger.info(
        { taskId, reviewSpaceId },
        "チェックリスト生成ワークフローのキャンセルを開始します",
      );

      const cancelled = await this.workflowRunRegistry.cancel(taskId);
      if (cancelled) {
        logger.info(
          { taskId, reviewSpaceId },
          "チェックリスト生成ワークフローのキャンセルが完了しました",
        );
      } else {
        logger.warn(
          { taskId, reviewSpaceId },
          "チェックリスト生成ワークフローのキャンセルに失敗しました",
        );
      }
    } catch (error) {
      logger.warn(
        { err: error, taskId, reviewSpaceId },
        "チェックリスト生成ワークフローのキャンセル中にエラーが発生しました（削除処理は続行します）",
      );
    } finally {
      this.workflowRunRegistry.setCancelling(false);
    }
  }

  /**
   * タスクファイルを削除する
   */
  private async deleteTaskFiles(
    taskId: string,
    reviewTargetId: string,
  ): Promise<void> {
    try {
      await TaskFileHelper.deleteTaskFiles(taskId);
    } catch (error) {
      logger.warn(
        { err: error, taskId, reviewTargetId },
        "タスクファイルの削除中にエラーが発生しました（削除処理は続行します）",
      );
    }
  }

  /**
   * チェックリスト生成タスクファイルを削除する
   */
  private async deleteChecklistTaskFiles(
    taskId: string,
    reviewSpaceId: string,
  ): Promise<void> {
    try {
      await TaskFileHelper.deleteTaskFiles(taskId);
    } catch (error) {
      logger.warn(
        { err: error, taskId, reviewSpaceId },
        "チェックリスト生成タスクファイルの削除中にエラーが発生しました（削除処理は続行します）",
      );
    }
  }

  /**
   * キャッシュディレクトリを削除する
   */
  private async deleteCacheDirectory(reviewTargetId: string): Promise<void> {
    try {
      await ReviewCacheHelper.deleteCacheDirectory(reviewTargetId);
      logger.debug({ reviewTargetId }, "キャッシュディレクトリを削除しました");
    } catch (error) {
      logger.warn(
        { err: error, reviewTargetId },
        "キャッシュディレクトリの削除中にエラーが発生しました（削除処理は続行します）",
      );
    }
  }
}
