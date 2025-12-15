import { IAiTaskRepository } from "@/application/shared/port/repository/IAiTaskRepository";
import { IProjectRepository } from "@/application/shared/port/repository";
import { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import { AI_TASK_STATUS } from "@/domain/aiTask";
import { ProjectId } from "@/domain/project";
import { ReviewSpaceId } from "@/domain/reviewSpace";
import { domainValidationError } from "@/lib/server/error";
import { TaskFileHelper } from "@/lib/server/taskFileHelper";

/**
 * チェックリスト生成タスクキャンセルコマンド（入力DTO）
 */
export interface CancelChecklistGenerationTaskCommand {
  /** レビュースペースID */
  reviewSpaceId: string;
  /** 実行ユーザーID（権限確認用） */
  userId: string;
}

/**
 * チェックリスト生成タスクキャンセルサービス
 * キュー待機中のチェックリスト生成タスクをキャンセルする
 */
export class CancelChecklistGenerationTaskService {
  constructor(
    private readonly aiTaskRepository: IAiTaskRepository,
    private readonly reviewSpaceRepository: IReviewSpaceRepository,
    private readonly projectRepository: IProjectRepository,
  ) {}

  /**
   * チェックリスト生成タスクキャンセルを実行
   * @param command キャンセルコマンド
   * @throws タスクが見つからない場合、処理中の場合はエラー
   */
  async execute(command: CancelChecklistGenerationTaskCommand): Promise<void> {
    const { reviewSpaceId, userId } = command;

    // レビュースペースの存在確認
    const reviewSpaceIdVo = ReviewSpaceId.reconstruct(reviewSpaceId);
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
      throw domainValidationError("PROJECT_ACCESS_DENIED");
    }

    // チェックリスト生成タスクを検索
    const task =
      await this.aiTaskRepository.findChecklistGenerationTaskByReviewSpaceId(
        reviewSpaceId,
      );

    if (!task) {
      throw domainValidationError("AI_TASK_NOT_FOUND");
    }

    // 処理中のタスクはキャンセル不可
    if (task.status.value === AI_TASK_STATUS.PROCESSING) {
      throw domainValidationError("AI_TASK_CANNOT_CANCEL_PROCESSING");
    }

    // タスクに紐づくファイルを削除
    await TaskFileHelper.deleteTaskFiles(task.id.value);

    // タスクを削除
    await this.aiTaskRepository.delete(task.id);
  }
}
