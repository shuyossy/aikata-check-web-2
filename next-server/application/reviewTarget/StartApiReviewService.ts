import { IReviewTargetRepository } from "@/application/shared/port/repository/IReviewTargetRepository";
import { ICheckListItemRepository } from "@/application/shared/port/repository/ICheckListItemRepository";
import { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import { IProjectRepository } from "@/application/shared/port/repository";
import { ReviewTarget } from "@/domain/reviewTarget";
import { ReviewSpaceId } from "@/domain/reviewSpace";
import { ProjectId } from "@/domain/project";
import { domainValidationError, internalError } from "@/lib/server/error";
import type { EvaluationCriterion } from "@/application/mastra";

/**
 * レビュー設定の入力型（外部API用）
 */
export interface ApiReviewSettingsCommand {
  /** 追加指示 */
  additionalInstructions?: string | null;
  /** 同時レビュー項目数 */
  concurrentReviewItems?: number;
  /** コメントフォーマット */
  commentFormat?: string | null;
  /** 評価基準 */
  evaluationCriteria?: EvaluationCriterion[];
}

/**
 * 外部APIレビュー開始コマンド（入力DTO）
 */
export interface StartApiReviewCommand {
  /** レビュースペースID */
  reviewSpaceId: string;
  /** レビュー対象名 */
  name: string;
  /** 実行ユーザーID（権限確認用） */
  userId: string;
  /** レビュー設定 */
  reviewSettings?: ApiReviewSettingsCommand;
}

/**
 * チェックリスト項目DTO
 */
export interface CheckListItemDto {
  /** チェック項目ID */
  id: string;
  /** チェック項目内容 */
  content: string;
}

/**
 * 外部APIレビュー開始結果DTO
 */
export interface StartApiReviewResult {
  /** レビュー対象ID */
  reviewTargetId: string;
  /** チェックリスト項目（スナップショット） */
  checkListItems: CheckListItemDto[];
  /** 同時レビュー項目数 */
  concurrentReviewItems: number;
}

/**
 * 外部APIレビュー開始サービス
 * クライアントサイドで外部APIを呼び出すためのレビュー対象を作成する
 *
 * - ReviewTarget作成（reviewType="api"、status="reviewing"）
 * - ドキュメントキャッシュは保存しない
 * - チェックリスト項目のスナップショットを返す
 */
export class StartApiReviewService {
  constructor(
    private readonly reviewTargetRepository: IReviewTargetRepository,
    private readonly checkListItemRepository: ICheckListItemRepository,
    private readonly reviewSpaceRepository: IReviewSpaceRepository,
    private readonly projectRepository: IProjectRepository,
  ) {}

  /**
   * 外部APIレビューを開始
   * @param command 開始コマンド
   * @returns レビュー対象IDとチェックリスト項目
   */
  async execute(command: StartApiReviewCommand): Promise<StartApiReviewResult> {
    const { reviewSpaceId, name, userId, reviewSettings } = command;

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

    // チェックリスト項目の取得
    const checkListItems =
      await this.checkListItemRepository.findByReviewSpaceId(reviewSpaceIdVo);
    if (checkListItems.length === 0) {
      throw internalError({
        expose: true,
        messageCode: "REVIEW_EXECUTION_NO_CHECKLIST",
      });
    }

    // デフォルトの同時レビュー項目数
    const concurrentReviewItems = reviewSettings?.concurrentReviewItems ?? 10;

    // レビュー対象エンティティを作成（reviewType="api"）し、即座にreviewingステータスに遷移
    const reviewTarget = ReviewTarget.create({
      reviewSpaceId,
      name,
      reviewSettings: reviewSettings
        ? {
            additionalInstructions:
              reviewSettings.additionalInstructions ?? null,
            concurrentReviewItems,
            commentFormat: reviewSettings.commentFormat ?? null,
            evaluationCriteria: reviewSettings.evaluationCriteria,
          }
        : null,
      reviewType: "api",
    }).startReviewing();

    // レビュー対象をDBに保存（ステータス: reviewing）
    await this.reviewTargetRepository.save(reviewTarget);

    // チェックリスト項目をDTO形式で返す
    const checkListItemDtos: CheckListItemDto[] = checkListItems.map(
      (item) => ({
        id: item.id.value,
        content: item.content.value,
      }),
    );

    return {
      reviewTargetId: reviewTarget.id.value,
      checkListItems: checkListItemDtos,
      concurrentReviewItems,
    };
  }
}
