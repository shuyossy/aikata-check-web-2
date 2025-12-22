import { IReviewTargetRepository } from "@/application/shared/port/repository/IReviewTargetRepository";
import { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import {
  IProjectRepository,
  IAiTaskRepository,
} from "@/application/shared/port/repository";
import { type IWorkflowRunRegistry } from "@/application/aiTask/WorkflowRunRegistry";
import { ReviewTargetId } from "@/domain/reviewTarget";
import { ReviewSpaceId } from "@/domain/reviewSpace";
import { ProjectId } from "@/domain/project";
import { domainValidationError } from "@/lib/server/error";
import { TaskFileHelper } from "@/lib/server/taskFileHelper";
import { ReviewCacheHelper } from "@/lib/server/reviewCacheHelper";
import { getLogger } from "@/lib/server/logger";

const logger = getLogger();

/**
 * レビュー対象削除コマンド（入力DTO）
 */
export interface DeleteReviewTargetCommand {
  /** レビュー対象ID */
  reviewTargetId: string;
  /** 実行ユーザーID（権限確認用） */
  userId: string;
}

/**
 * レビュー対象削除サービス
 */
export class DeleteReviewTargetService {
  constructor(
    private readonly reviewTargetRepository: IReviewTargetRepository,
    private readonly reviewSpaceRepository: IReviewSpaceRepository,
    private readonly projectRepository: IProjectRepository,
    private readonly aiTaskRepository: IAiTaskRepository,
    private readonly workflowRunRegistry?: IWorkflowRunRegistry,
  ) {}

  /**
   * レビュー対象を削除
   * @param command 削除コマンド
   */
  async execute(command: DeleteReviewTargetCommand): Promise<void> {
    const { reviewTargetId, userId } = command;

    // レビュー対象の取得
    const reviewTargetIdVo = ReviewTargetId.reconstruct(reviewTargetId);
    const reviewTarget =
      await this.reviewTargetRepository.findById(reviewTargetIdVo);
    if (!reviewTarget) {
      throw domainValidationError("REVIEW_TARGET_NOT_FOUND");
    }

    // レビュースペースの存在確認
    const reviewSpaceIdVo = ReviewSpaceId.reconstruct(
      reviewTarget.reviewSpaceId.value,
    );
    const reviewSpace =
      await this.reviewSpaceRepository.findById(reviewSpaceIdVo);
    if (!reviewSpace) {
      throw domainValidationError("REVIEW_SPACE_NOT_FOUND");
    }

    // プロジェクトの存在確認
    const projectId = ProjectId.reconstruct(reviewSpace.projectId.value);
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw domainValidationError("PROJECT_NOT_FOUND");
    }

    // プロジェクトへのアクセス権確認
    if (!project.hasMember(userId)) {
      throw domainValidationError("REVIEW_TARGET_ACCESS_DENIED");
    }

    // レビュー対象に紐づくAIタスクを検索し、ワークフローキャンセル・ファイル削除を行う
    const aiTask =
      await this.aiTaskRepository.findByReviewTargetId(reviewTargetId);
    if (aiTask) {
      const taskId = aiTask.id.value;

      // PROCESSING状態の場合、ワークフローをキャンセル
      if (aiTask.status.value === "processing" && this.workflowRunRegistry) {
        try {
          // キャンセル中フラグを設定（新規タスクのデキューをブロック）
          this.workflowRunRegistry.setCancelling(true);

          logger.info(
            { taskId, reviewTargetId },
            "ワークフローのキャンセルを開始します",
          );

          // ワークフローをキャンセル
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
          // キャンセル失敗時は警告ログを記録して削除処理を続行
          logger.warn(
            { err: error, taskId, reviewTargetId },
            "ワークフローのキャンセル中にエラーが発生しました（削除処理は続行します）",
          );
        } finally {
          // キャンセル中フラグを解除
          this.workflowRunRegistry.setCancelling(false);
        }
      }

      // タスクに紐づくファイルを削除
      await TaskFileHelper.deleteTaskFiles(taskId);
      // AIタスクを削除
      await this.aiTaskRepository.deleteByReviewTargetId(reviewTargetId);
    }

    // キャッシュディレクトリを削除
    try {
      await ReviewCacheHelper.deleteCacheDirectory(reviewTargetId);
      logger.debug({ reviewTargetId }, "キャッシュディレクトリを削除しました");
    } catch (error) {
      // キャッシュ削除失敗時は警告ログを記録して削除処理を続行
      logger.warn(
        { err: error, reviewTargetId },
        "キャッシュディレクトリの削除中にエラーが発生しました（削除処理は続行します）",
      );
    }

    // レビュー対象を削除（CASCADE設定によりレビュー結果も削除される）
    await this.reviewTargetRepository.delete(reviewTargetIdVo);
  }
}
