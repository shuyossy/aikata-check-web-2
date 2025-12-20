import { IProjectRepository, IAiTaskRepository } from "@/application/shared/port/repository";
import { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import { IReviewTargetRepository } from "@/application/shared/port/repository/IReviewTargetRepository";
import { type IWorkflowRunRegistry } from "@/application/aiTask/WorkflowRunRegistry";
import { ReviewTargetCleanupHelper } from "@/application/shared/ReviewTargetCleanupHelper";
import { ProjectId } from "@/domain/project";
import { domainValidationError } from "@/lib/server/error";

/**
 * プロジェクト削除コマンド（入力DTO）
 */
export interface DeleteProjectCommand {
  /** プロジェクトID */
  projectId: string;
  /** リクエストユーザID */
  userId: string;
  /** 管理者フラグ（管理者の場合はメンバーチェックをスキップ） */
  isAdmin?: boolean;
}

/**
 * プロジェクト削除サービス
 * プロジェクトを削除する（メンバーであれば誰でも削除可能）
 */
export class DeleteProjectService {
  private readonly cleanupHelper?: ReviewTargetCleanupHelper;

  constructor(
    private readonly projectRepository: IProjectRepository,
    private readonly reviewSpaceRepository?: IReviewSpaceRepository,
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
   * プロジェクト削除を実行
   * @param command 削除コマンド
   * @throws ドメインバリデーションエラー - プロジェクトが存在しない場合、またはアクセス権がない場合
   */
  async execute(command: DeleteProjectCommand): Promise<void> {
    const { projectId, userId, isAdmin } = command;

    const projectIdVo = ProjectId.reconstruct(projectId);

    // プロジェクトを取得
    const project = await this.projectRepository.findById(projectIdVo);

    if (!project) {
      throw domainValidationError("PROJECT_NOT_FOUND");
    }

    // アクセス権の確認（管理者またはメンバーのみ削除可能）
    if (!isAdmin && !project.hasMember(userId)) {
      throw domainValidationError("PROJECT_ACCESS_DENIED");
    }

    // カスケードクリーンアップ処理（クリーンアップヘルパーが初期化されている場合のみ）
    if (this.reviewSpaceRepository && this.cleanupHelper) {
      await this.cleanupProject(projectId);
    }

    // 削除
    await this.projectRepository.delete(projectIdVo);
  }

  /**
   * プロジェクト内の全レビュースペースをクリーンアップする
   */
  private async cleanupProject(projectId: string): Promise<void> {
    if (!this.reviewSpaceRepository || !this.cleanupHelper) {
      return;
    }

    const projectIdVo = ProjectId.reconstruct(projectId);
    const reviewSpaces =
      await this.reviewSpaceRepository.findByProjectId(projectIdVo);

    for (const reviewSpace of reviewSpaces) {
      const reviewSpaceId = reviewSpace.id.value;

      // レビュースペース内の全レビュー対象をクリーンアップ
      await this.cleanupHelper.cleanupReviewTargets(reviewSpaceId);

      // チェックリスト生成タスクのクリーンアップ
      await this.cleanupHelper.cleanupChecklistGenerationTask(reviewSpaceId);
    }
  }
}
