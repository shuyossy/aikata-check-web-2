import { RuntimeContext } from "@mastra/core/di";
import { IReviewTargetRepository } from "@/application/shared/port/repository/IReviewTargetRepository";
import { IReviewResultRepository } from "@/application/shared/port/repository/IReviewResultRepository";
import { ICheckListItemRepository } from "@/application/shared/port/repository/ICheckListItemRepository";
import { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import { IProjectRepository } from "@/application/shared/port/repository";
import { ReviewTarget } from "@/domain/reviewTarget";
import { ReviewResult } from "@/domain/reviewResult";
import { ReviewSpaceId } from "@/domain/reviewSpace";
import { ProjectId } from "@/domain/project";
import {
  AppError,
  domainValidationError,
  internalError,
  normalizeUnknownError,
} from "@/lib/server/error";
import { mastra, checkWorkflowResult } from "@/application/mastra";
import type {
  RawUploadFileMeta,
  FileBuffersMap,
  ReviewExecutionWorkflowRuntimeContext,
  EvaluationCriterion,
  SingleReviewResult,
  ReviewType,
} from "@/application/mastra";
import { FILE_BUFFERS_CONTEXT_KEY } from "@/application/mastra";

/**
 * レビュー設定の入力型
 */
export interface ReviewSettingsCommand {
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
 * レビュー実行コマンド（入力DTO）
 */
export interface ExecuteReviewCommand {
  /** レビュースペースID */
  reviewSpaceId: string;
  /** レビュー対象名 */
  name: string;
  /** 実行ユーザーID（権限確認用） */
  userId: string;
  /** ファイルメタデータの配列（バイナリデータはfileBuffersで渡す） */
  files: RawUploadFileMeta[];
  /** ファイルバッファのマップ（キー: ファイルID、値: バッファデータ） */
  fileBuffers: FileBuffersMap;
  /** レビュー設定 */
  reviewSettings?: ReviewSettingsCommand;
  /** レビュー種別（デフォルト: small） */
  reviewType?: ReviewType;
}

/**
 * レビュー実行結果DTO
 */
export interface ExecuteReviewResult {
  /** レビュー対象ID */
  reviewTargetId: string;
  /** ステータス */
  status: string;
  /** レビュー結果の配列 */
  reviewResults: Array<{
    /** チェック項目の内容（スナップショット） */
    checkListItemContent: string;
    evaluation: string | null;
    comment: string | null;
    errorMessage: string | null;
  }>;
}

/**
 * レビュー実行サービス
 * ドキュメントをチェックリストに基づいてAIレビューする
 */
export class ExecuteReviewService {
  constructor(
    private readonly reviewTargetRepository: IReviewTargetRepository,
    private readonly reviewResultRepository: IReviewResultRepository,
    private readonly checkListItemRepository: ICheckListItemRepository,
    private readonly reviewSpaceRepository: IReviewSpaceRepository,
    private readonly projectRepository: IProjectRepository,
  ) {}

  /**
   * レビュー実行
   * @param command 実行コマンド
   * @returns レビュー結果
   */
  async execute(command: ExecuteReviewCommand): Promise<ExecuteReviewResult> {
    const {
      reviewSpaceId,
      name,
      userId,
      files,
      fileBuffers,
      reviewSettings,
      reviewType = "small",
    } = command;

    // 入力バリデーション
    if (files.length === 0) {
      throw internalError({
        expose: true,
        messageCode: "REVIEW_EXECUTION_NO_FILES",
      });
    }

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

    // レビュー対象エンティティを作成
    const reviewTarget = ReviewTarget.create({
      reviewSpaceId,
      name,
      reviewSettings: reviewSettings
        ? {
            additionalInstructions:
              reviewSettings.additionalInstructions ?? null,
            concurrentReviewItems: reviewSettings.concurrentReviewItems,
            commentFormat: reviewSettings.commentFormat ?? null,
            evaluationCriteria: reviewSettings.evaluationCriteria,
          }
        : null,
    });

    // レビュー対象をDBに保存（ステータス: pending）
    await this.reviewTargetRepository.save(reviewTarget);

    // ステータスをreviewingに更新
    const reviewingTarget = reviewTarget.startReviewing();
    await this.reviewTargetRepository.save(reviewingTarget);

    // ワークフロー実行
    let workflowResults: SingleReviewResult[];
    let finalTarget: ReviewTarget;

    try {
      const workflow = mastra.getWorkflow("reviewExecutionWorkflow");
      const run = await workflow.createRunAsync();

      // RuntimeContextを作成
      const runtimeContext =
        new RuntimeContext<ReviewExecutionWorkflowRuntimeContext>();
      runtimeContext.set("employeeId", userId);
      const decryptedApiKey = project.encryptedApiKey?.decrypt();
      if (decryptedApiKey) {
        runtimeContext.set("projectApiKey", decryptedApiKey);
      }
      // ファイルバッファをRuntimeContextに設定
      runtimeContext.set(FILE_BUFFERS_CONTEXT_KEY, fileBuffers);

      // レビュー対象IDを設定
      runtimeContext.set("reviewTargetId", reviewTarget.id.value);

      // DB保存コールバックを設定
      // チャンクごとのレビュー完了時に呼び出される
      const onReviewResultSaved = async (
        results: SingleReviewResult[],
        targetId: string,
      ): Promise<void> => {
        const entities: ReviewResult[] = [];
        for (const result of results) {
          let entity: ReviewResult;
          if (result.errorMessage) {
            entity = ReviewResult.createError({
              reviewTargetId: targetId,
              checkListItemContent: result.checkListItemContent,
              errorMessage: result.errorMessage,
            });
          } else {
            entity = ReviewResult.createSuccess({
              reviewTargetId: targetId,
              checkListItemContent: result.checkListItemContent,
              evaluation: result.evaluation ?? "",
              comment: result.comment ?? "",
            });
          }
          entities.push(entity);
        }
        await this.reviewResultRepository.saveMany(entities);
      };
      runtimeContext.set("onReviewResultSaved", onReviewResultSaved);

      // チェックリスト項目をワークフロー入力形式に変換
      const checkListItemsInput = checkListItems.map((item) => ({
        id: item.id.value,
        content: item.content.value,
      }));

      const result = await run.start({
        inputData: {
          files,
          checkListItems: checkListItemsInput,
          reviewSettings: reviewSettings
            ? {
                additionalInstructions:
                  reviewSettings.additionalInstructions ?? null,
                concurrentReviewItems: reviewSettings.concurrentReviewItems,
                commentFormat: reviewSettings.commentFormat ?? null,
                evaluationCriteria: reviewSettings.evaluationCriteria,
              }
            : undefined,
          reviewType,
        },
        runtimeContext,
      });

      // ワークフロー結果の検証
      const checkResult = checkWorkflowResult(result);
      if (checkResult.status !== "success") {
        // ワークフロー失敗時はエラーステータスに更新
        finalTarget = reviewingTarget.markAsError();
        await this.reviewTargetRepository.save(finalTarget);
        throw internalError({
          expose: true,
          messageCode: "REVIEW_EXECUTION_FAILED",
          messageParams: {
            detail:
              checkResult.errorMessage || "ワークフロー実行に失敗しました",
          },
        });
      }

      // ワークフロー結果からレビュー結果を取得
      if (result.status !== "success") {
        finalTarget = reviewingTarget.markAsError();
        await this.reviewTargetRepository.save(finalTarget);
        throw internalError({
          expose: true,
          messageCode: "REVIEW_EXECUTION_FAILED",
          messageParams: { detail: "ワークフロー結果の取得に失敗しました" },
        });
      }

      const workflowResult = result.result as
        | {
            status: string;
            reviewResults?: SingleReviewResult[];
            errorMessage?: string;
          }
        | undefined;

      if (
        !workflowResult?.reviewResults ||
        workflowResult.reviewResults.length === 0
      ) {
        finalTarget = reviewingTarget.markAsError();
        await this.reviewTargetRepository.save(finalTarget);
        throw internalError({
          expose: true,
          messageCode: "REVIEW_EXECUTION_FAILED",
          messageParams: { detail: "レビュー結果が取得できませんでした" },
        });
      }

      workflowResults = workflowResult.reviewResults;

      // ワークフロー成功時は完了ステータスに更新
      finalTarget = reviewingTarget.completeReview();
      await this.reviewTargetRepository.save(finalTarget);
    } catch (error) {
      // AppErrorの場合はそのまま再スロー
      if (error instanceof AppError) {
        throw error;
      }
      // その他のエラーをnormalizeUnknownErrorで正規化
      const normalizedError = normalizeUnknownError(error);
      // エラー時はステータスを更新
      try {
        finalTarget = reviewingTarget.markAsError();
        await this.reviewTargetRepository.save(finalTarget);
      } catch {
        // ステータス更新失敗は無視
      }
      throw normalizedError;
    }

    // レビュー結果はチャンクごとにDB保存コールバックで保存済み
    // ここでは最終結果を返すのみ
    return {
      reviewTargetId: finalTarget.id.value,
      status: finalTarget.status.value,
      reviewResults: workflowResults.map((r) => ({
        checkListItemContent: r.checkListItemContent,
        evaluation: r.evaluation,
        comment: r.comment,
        errorMessage: r.errorMessage,
      })),
    };
  }
}
