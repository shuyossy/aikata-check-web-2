import { IQaHistoryRepository } from "@/application/shared/port/repository/IQaHistoryRepository";
import { IReviewTargetRepository } from "@/application/shared/port/repository/IReviewTargetRepository";
import { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import { IProjectRepository } from "@/application/shared/port/repository";
import { ReviewTargetId } from "@/domain/reviewTarget";
import { ReviewSpaceId } from "@/domain/reviewSpace";
import { ProjectId } from "@/domain/project";
import { domainValidationError } from "@/lib/server/error";

/**
 * Q&A履歴一覧取得コマンド（入力DTO）
 */
export interface ListQaHistoriesCommand {
  /** レビュー対象ID */
  reviewTargetId: string;
  /** 実行ユーザーID（権限確認用） */
  userId: string;
  /** ページネーション: 取得件数（デフォルト: 20） */
  limit?: number;
  /** ページネーション: オフセット（デフォルト: 0） */
  offset?: number;
}

/**
 * Q&A履歴DTO
 */
export interface QaHistoryDto {
  /** Q&A履歴ID */
  id: string;
  /** 質問内容 */
  question: string;
  /** チェックリスト項目の内容 */
  checklistItemContent: string;
  /** 回答 */
  answer: string | null;
  /** 調査サマリー（JSON文字列） */
  researchSummary: string | null;
  /** ステータス */
  status: "pending" | "processing" | "completed" | "error";
  /** エラーメッセージ */
  errorMessage: string | null;
  /** 作成日時 */
  createdAt: Date;
  /** 更新日時 */
  updatedAt: Date;
}

/**
 * Q&A履歴一覧取得結果DTO
 */
export interface ListQaHistoriesResult {
  /** Q&A履歴一覧 */
  items: QaHistoryDto[];
  /** 総件数 */
  total: number;
}

/**
 * Q&A履歴一覧取得サービス
 * レビュー対象に紐づくQ&A履歴を取得する
 */
export class ListQaHistoriesService {
  constructor(
    private readonly qaHistoryRepository: IQaHistoryRepository,
    private readonly reviewTargetRepository: IReviewTargetRepository,
    private readonly reviewSpaceRepository: IReviewSpaceRepository,
    private readonly projectRepository: IProjectRepository,
  ) {}

  /**
   * Q&A履歴一覧を取得
   * @param command 取得コマンド
   * @returns Q&A履歴一覧
   */
  async execute(command: ListQaHistoriesCommand): Promise<ListQaHistoriesResult> {
    const { reviewTargetId, userId, limit = 20, offset = 0 } = command;

    // レビュー対象の存在確認
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

    // Q&A履歴を取得
    const { items, total } = await this.qaHistoryRepository.findByReviewTargetId(
      reviewTargetIdVo,
      { limit, offset },
    );

    return {
      items: items.map((qaHistory) => ({
        id: qaHistory.id.value,
        question: qaHistory.question.value,
        checklistItemContent: qaHistory.checkListItemContent.value,
        answer: qaHistory.answer?.value ?? null,
        researchSummary: qaHistory.researchSummary ? JSON.stringify(qaHistory.researchSummary.toJson()) : null,
        status: qaHistory.status.value,
        errorMessage: qaHistory.errorMessage,
        createdAt: qaHistory.createdAt,
        updatedAt: qaHistory.updatedAt,
      })),
      total,
    };
  }
}
