import { IQaHistoryRepository } from "@/application/shared/port/repository/IQaHistoryRepository";
import { IReviewTargetRepository } from "@/application/shared/port/repository/IReviewTargetRepository";
import { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import { IProjectRepository } from "@/application/shared/port/repository";
import { QaHistory, Question, CheckListItemContent } from "@/domain/qaHistory";
import { ReviewTargetId } from "@/domain/reviewTarget";
import { ReviewSpaceId } from "@/domain/reviewSpace";
import { ProjectId } from "@/domain/project";
import { UserId } from "@/domain/user";
import { domainValidationError } from "@/lib/server/error";

/**
 * Q&A実行コマンド（入力DTO）
 */
export interface ExecuteQaCommand {
  /** レビュー対象ID */
  reviewTargetId: string;
  /** 質問内容 */
  question: string;
  /** 選択されたチェックリスト項目の内容（複数） */
  checklistItemContents: string[];
  /** 実行ユーザーID */
  userId: string;
}

/**
 * Q&A実行結果DTO
 */
export interface ExecuteQaResult {
  /** Q&A履歴ID */
  qaHistoryId: string;
}

/**
 * Q&A実行サービス
 * レビュー結果に対する質問を処理し、Q&A履歴を作成する
 *
 * 注意: このサービスはQ&A履歴の作成のみを行い、ワークフローの実行は行わない。
 * ワークフローはSSE接続確立後にStartQaWorkflowServiceによって開始される。
 */
export class ExecuteQaService {
  constructor(
    private readonly qaHistoryRepository: IQaHistoryRepository,
    private readonly reviewTargetRepository: IReviewTargetRepository,
    private readonly reviewSpaceRepository: IReviewSpaceRepository,
    private readonly projectRepository: IProjectRepository,
  ) {}

  /**
   * Q&Aを実行
   * Q&A履歴をpending状態で作成する。
   * ワークフローの実行はSSE接続確立後にStartQaWorkflowServiceが行う。
   *
   * @param command 実行コマンド
   * @returns Q&A履歴ID
   */
  async execute(command: ExecuteQaCommand): Promise<ExecuteQaResult> {
    const { reviewTargetId, question, checklistItemContents, userId } = command;

    // チェックリスト項目が選択されていることを確認
    if (!checklistItemContents || checklistItemContents.length === 0) {
      throw domainValidationError("QA_HISTORY_CHECKLIST_ITEM_CONTENT_EMPTY");
    }

    // レビュー対象の存在確認と権限チェック
    const reviewTargetIdVo = ReviewTargetId.reconstruct(reviewTargetId);
    const reviewTarget = await this.reviewTargetRepository.findById(reviewTargetIdVo);
    if (!reviewTarget) {
      throw domainValidationError("REVIEW_TARGET_NOT_FOUND");
    }

    // レビュースペースの存在確認
    const reviewSpaceIdVo = ReviewSpaceId.reconstruct(reviewTarget.reviewSpaceId.value);
    const reviewSpace = await this.reviewSpaceRepository.findById(reviewSpaceIdVo);
    if (!reviewSpace) {
      throw domainValidationError("REVIEW_SPACE_NOT_FOUND");
    }

    // プロジェクトの存在確認と権限チェック
    const projectId = ProjectId.reconstruct(reviewSpace.projectId.value);
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw domainValidationError("PROJECT_NOT_FOUND");
    }

    if (!project.hasMember(userId)) {
      throw domainValidationError("REVIEW_TARGET_ACCESS_DENIED");
    }

    // Q&A履歴エンティティを作成して保存（pending状態で開始）
    // 複数のチェックリスト項目はJSON配列として保存
    // ワークフローはSSE接続確立後に開始される
    const qaHistory = QaHistory.create({
      reviewTargetId: reviewTargetIdVo,
      userId: UserId.reconstruct(userId),
      question: Question.create(question),
      checkListItemContent: CheckListItemContent.create(JSON.stringify(checklistItemContents)),
    });
    await this.qaHistoryRepository.save(qaHistory);

    return {
      qaHistoryId: qaHistory.id.value,
    };
  }
}
