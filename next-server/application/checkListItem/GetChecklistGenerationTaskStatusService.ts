import { IAiTaskRepository } from "@/application/shared/port/repository/IAiTaskRepository";
import { IProjectRepository } from "@/application/shared/port/repository";
import { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import { ProjectId } from "@/domain/project";
import { ReviewSpaceId } from "@/domain/reviewSpace";
import { domainValidationError } from "@/lib/server/error";

/**
 * チェックリスト生成タスク状態取得コマンド（入力DTO）
 */
export interface GetChecklistGenerationTaskStatusCommand {
  /** レビュースペースID */
  reviewSpaceId: string;
  /** 実行ユーザーID（権限確認用） */
  userId: string;
}

/**
 * チェックリスト生成タスク状態DTO
 */
export interface ChecklistGenerationTaskStatusDto {
  /** タスクが存在するか */
  hasTask: boolean;
  /** タスクステータス（queued/processing、存在しない場合はnull） */
  status: "queued" | "processing" | null;
  /** タスクID（存在しない場合はnull） */
  taskId: string | null;
  /** チェックリスト生成エラーメッセージ（エラー時のみ） */
  errorMessage: string | null;
}

/**
 * チェックリスト生成タスク状態取得サービス
 * レビュースペースに紐づくチェックリスト生成タスクの状態を取得する
 */
export class GetChecklistGenerationTaskStatusService {
  constructor(
    private readonly aiTaskRepository: IAiTaskRepository,
    private readonly reviewSpaceRepository: IReviewSpaceRepository,
    private readonly projectRepository: IProjectRepository,
  ) {}

  /**
   * チェックリスト生成タスク状態取得を実行
   * @param command 取得コマンド
   * @returns タスク状態DTO
   */
  async execute(
    command: GetChecklistGenerationTaskStatusCommand,
  ): Promise<ChecklistGenerationTaskStatusDto> {
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
      return {
        hasTask: false,
        status: null,
        taskId: null,
        errorMessage: reviewSpace.checklistGenerationError,
      };
    }

    return {
      hasTask: true,
      status: task.status.value as "queued" | "processing",
      taskId: task.id.value,
      errorMessage: reviewSpace.checklistGenerationError,
    };
  }
}
