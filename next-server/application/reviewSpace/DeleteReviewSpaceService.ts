import {
  IProjectRepository,
  IAiTaskRepository,
} from "@/application/shared/port/repository";
import { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import { IReviewTargetRepository } from "@/application/shared/port/repository/IReviewTargetRepository";
import { type IWorkflowRunRegistry } from "@/application/aiTask/WorkflowRunRegistry";
import { ReviewTargetCleanupHelper } from "@/application/shared/ReviewTargetCleanupHelper";
import { ReviewSpaceId } from "@/domain/reviewSpace";
import { domainValidationError } from "@/lib/server/error";

/**
 * レビュースペース削除コマンド（入力DTO）
 */
export interface DeleteReviewSpaceCommand {
  /** レビュースペースID */
  reviewSpaceId: string;
  /** 実行ユーザーID（権限確認用） */
  userId: string;
}

/**
 * レビュースペース削除サービス
 * レビュースペースを削除する
 */
export class DeleteReviewSpaceService {
  private readonly cleanupHelper?: ReviewTargetCleanupHelper;

  constructor(
    private readonly reviewSpaceRepository: IReviewSpaceRepository,
    private readonly projectRepository: IProjectRepository,
    private readonly reviewTargetRepository?: IReviewTargetRepository,
    private readonly aiTaskRepository?: IAiTaskRepository,
    private readonly workflowRunRegistry?: IWorkflowRunRegistry,
  ) {
    // クリーンアップヘルパーの初期化
    if (this.reviewTargetRepository && this.aiTaskRepository) {
      this.cleanupHelper = new ReviewTargetCleanupHelper(
        this.reviewTargetRepository,
        this.aiTaskRepository,
        this.workflowRunRegistry,
      );
    }
  }

  /**
   * レビュースペース削除を実行
   * @param command 削除コマンド
   * @throws ドメインバリデーションエラー - レビュースペースが存在しない、またはアクセス権がない場合
   */
  async execute(command: DeleteReviewSpaceCommand): Promise<void> {
    const { reviewSpaceId, userId } = command;

    // レビュースペースの存在確認
    const reviewSpaceIdVo = ReviewSpaceId.reconstruct(reviewSpaceId);
    const reviewSpace =
      await this.reviewSpaceRepository.findById(reviewSpaceIdVo);
    if (!reviewSpace) {
      throw domainValidationError("REVIEW_SPACE_NOT_FOUND");
    }

    // プロジェクトの存在確認
    const project = await this.projectRepository.findById(
      reviewSpace.projectId,
    );
    if (!project) {
      throw domainValidationError("PROJECT_NOT_FOUND");
    }

    // プロジェクトへのアクセス権確認
    if (!project.hasMember(userId)) {
      throw domainValidationError("PROJECT_ACCESS_DENIED");
    }

    // カスケードクリーンアップ処理（クリーンアップヘルパーが初期化されている場合のみ）
    if (this.cleanupHelper) {
      await this.cleanupHelper.cleanupReviewTargets(reviewSpaceId);
      await this.cleanupHelper.cleanupChecklistGenerationTask(reviewSpaceId);
    }

    // 削除
    await this.reviewSpaceRepository.delete(reviewSpaceIdVo);
  }
}
