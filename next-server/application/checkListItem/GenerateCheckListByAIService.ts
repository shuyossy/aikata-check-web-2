import { RuntimeContext } from "@mastra/core/di";
import { ICheckListItemRepository } from "@/application/shared/port/repository/ICheckListItemRepository";
import { IProjectRepository } from "@/application/shared/port/repository";
import { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import { CheckListItem } from "@/domain/checkListItem";
import { ProjectId } from "@/domain/project";
import { ReviewSpaceId } from "@/domain/reviewSpace";
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
  ChecklistGenerationWorkflowRuntimeContext,
} from "@/application/mastra";
import { FILE_BUFFERS_CONTEXT_KEY } from "@/application/mastra";

/**
 * AIチェックリスト生成コマンド（入力DTO）
 */
export interface GenerateCheckListByAICommand {
  /** レビュースペースID */
  reviewSpaceId: string;
  /** 実行ユーザーID（権限確認用） */
  userId: string;
  /** ファイルメタデータの配列（バイナリデータはfileBuffersで渡す） */
  files: RawUploadFileMeta[];
  /** ファイルバッファのマップ（キー: ファイルID、値: バッファデータ） */
  fileBuffers: FileBuffersMap;
  /** チェックリスト生成要件 */
  checklistRequirements: string;
}

/**
 * AIチェックリスト生成結果DTO
 */
export interface GenerateCheckListByAIResult {
  /** 生成された件数 */
  generatedCount: number;
  /** 生成されたチェック項目 */
  items: string[];
}

/**
 * AIチェックリスト生成サービス
 * ドキュメントとチェックリスト生成要件からAIがチェックリストを自動生成する
 */
export class GenerateCheckListByAIService {
  constructor(
    private readonly checkListItemRepository: ICheckListItemRepository,
    private readonly reviewSpaceRepository: IReviewSpaceRepository,
    private readonly projectRepository: IProjectRepository,
  ) {}

  /**
   * AIチェックリスト生成を実行
   * @param command 生成コマンド
   * @returns 生成結果
   */
  async execute(
    command: GenerateCheckListByAICommand,
  ): Promise<GenerateCheckListByAIResult> {
    const { reviewSpaceId, userId, files, fileBuffers, checklistRequirements } =
      command;

    // 入力バリデーション
    if (files.length === 0) {
      throw internalError({
        expose: true,
        messageCode: "AI_CHECKLIST_GENERATION_NO_FILES",
      });
    }

    if (!checklistRequirements.trim()) {
      throw internalError({
        expose: true,
        messageCode: "AI_CHECKLIST_GENERATION_REQUIREMENTS_EMPTY",
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

    // Mastraワークフローを実行
    let generatedItems: string[];
    try {
      const workflow = mastra.getWorkflow("checklistGenerationWorkflow");
      const run = await workflow.createRunAsync();

      // RuntimeContextを作成し、ユーザーID、プロジェクトのAPIキー、ファイルバッファを設定
      const runtimeContext =
        new RuntimeContext<ChecklistGenerationWorkflowRuntimeContext>();
      runtimeContext.set("employeeId", userId);
      const decryptedApiKey = project.encryptedApiKey?.decrypt();
      if (decryptedApiKey) {
        runtimeContext.set("projectApiKey", decryptedApiKey);
      }
      // ファイルバッファをRuntimeContextに設定（workflowのfileProcessingStepで使用）
      runtimeContext.set(FILE_BUFFERS_CONTEXT_KEY, fileBuffers);

      const result = await run.start({
        inputData: {
          files,
          checklistRequirements,
        },
        runtimeContext,
      });

      // ワークフローの結果を検証（checkWorkflowResult関数を使用）
      const checkResult = checkWorkflowResult(result);
      if (checkResult.status !== "success") {
        throw internalError({
          expose: true,
          messageCode: "AI_CHECKLIST_GENERATION_FAILED",
          messageParams: {
            detail: checkResult.errorMessage || "ワークフロー実行に失敗しました",
          },
        });
      }

      // ワークフローの結果からgeneratedItemsを取得
      // checkWorkflowResultが成功を返した場合、result.status === "success"が保証される
      if (result.status !== "success") {
        // この分岐には到達しないはずだが、型ガードとして必要
        throw internalError({
          expose: true,
          messageCode: "AI_CHECKLIST_GENERATION_FAILED",
          messageParams: { detail: "ワークフロー結果の取得に失敗しました" },
        });
      }

      const workflowResult = result.result as
        | {
            status: string;
            generatedItems?: string[];
            errorMessage?: string;
          }
        | undefined;

      if (
        !workflowResult?.generatedItems ||
        workflowResult.generatedItems.length === 0
      ) {
        throw internalError({
          expose: true,
          messageCode: "AI_CHECKLIST_GENERATION_NO_ITEMS_GENERATED",
        });
      }

      generatedItems = workflowResult.generatedItems;
    } catch (error) {
      // AppErrorの場合はそのまま再スロー（既に適切にハンドリング済み）
      if (error instanceof AppError) {
        throw error;
      }
      // AI関連エラー含む全てのエラーをnormalizeUnknownErrorで正規化
      throw normalizeUnknownError(error);
    }

    // チェック項目エンティティを生成
    const items = generatedItems.map((content) =>
      CheckListItem.create({
        reviewSpaceId,
        content,
      }),
    );

    // 一括追加を実行（既存のチェック項目に追加）
    await this.checkListItemRepository.bulkInsert(items);

    return {
      generatedCount: items.length,
      items: generatedItems,
    };
  }
}
