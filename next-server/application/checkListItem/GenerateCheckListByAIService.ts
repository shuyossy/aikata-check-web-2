import { IProjectRepository, ISystemSettingRepository } from "@/application/shared/port/repository";
import { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import { AiTaskQueueService } from "@/application/aiTask/AiTaskQueueService";
import { getAiTaskBootstrap } from "@/application/aiTask";
import { ProjectId } from "@/domain/project";
import { ReviewSpaceId } from "@/domain/reviewSpace";
import { AI_TASK_TYPE } from "@/domain/aiTask";
import { domainValidationError, internalError } from "@/lib/server/error";
import type { RawUploadFileMeta, FileBuffersMap } from "@/application/mastra";
import type { ChecklistGenerationTaskPayload } from "@/application/aiTask/AiTaskExecutor";

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
 * AIチェックリスト生成結果DTO（キュー登録版）
 */
export interface GenerateCheckListByAIResult {
  /** レビュースペースID */
  reviewSpaceId: string;
  /** ステータス（queued） */
  status: string;
  /** キュー長 */
  queueLength: number;
}

/**
 * AIチェックリスト生成サービス
 * ドキュメントとチェックリスト生成要件からAIがチェックリストを自動生成する（キュー登録版）
 */
export class GenerateCheckListByAIService {
  constructor(
    private readonly reviewSpaceRepository: IReviewSpaceRepository,
    private readonly projectRepository: IProjectRepository,
    private readonly systemSettingRepository: ISystemSettingRepository,
    private readonly aiTaskQueueService: AiTaskQueueService,
  ) {}

  /**
   * AIチェックリスト生成を実行（キューに登録）
   * @param command 生成コマンド
   * @returns キュー登録結果
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

    // APIキーを取得（プロジェクト設定 > 管理者設定 > 環境変数）
    const decryptedApiKey = project.encryptedApiKey?.decrypt();
    const systemSetting = await this.systemSettingRepository.find();
    const systemApiKey = systemSetting?.toDto().apiKey;
    const apiKey = decryptedApiKey ?? systemApiKey ?? process.env.AI_API_KEY;
    if (!apiKey) {
      throw internalError({
        expose: true,
        messageCode: "AI_TASK_NO_API_KEY",
      });
    }

    // ペイロードを作成
    const payload: ChecklistGenerationTaskPayload = {
      reviewSpaceId,
      userId,
      files,
      checklistRequirements,
      decryptedApiKey: decryptedApiKey ?? undefined,
    };

    // ファイルをFileInfoCommand形式に変換
    const fileInfoCommands = files.map((f) => {
      const bufferData = fileBuffers.get(f.id);
      if (!bufferData) {
        throw internalError({
          expose: true,
          messageCode: "AI_TASK_FILE_NOT_FOUND",
        });
      }

      // 画像モードの場合は変換済み画像のみを使用、テキストモードの場合は元ファイルを使用
      const processMode = f.processMode ?? "text";
      return {
        fileId: f.id,
        fileName: f.name,
        fileSize: f.size,
        mimeType: f.type,
        processMode,
        // テキストモード: 元ファイルのバッファ、画像モード: 空バッファ
        buffer: processMode === "text" ? bufferData.buffer : Buffer.alloc(0),
        // 画像モードの場合のみ変換済み画像を設定
        convertedImageBuffers:
          processMode === "image" ? bufferData.convertedImageBuffers : undefined,
      };
    });

    // キューに登録
    const enqueueResult = await this.aiTaskQueueService.enqueueTask({
      taskType: AI_TASK_TYPE.CHECKLIST_GENERATION,
      apiKey,
      payload: payload as unknown as Record<string, unknown>,
      files: fileInfoCommands,
    });

    // ワーカーを起動
    const aiTaskBootstrap = getAiTaskBootstrap();
    await aiTaskBootstrap.startWorkersForApiKeyHash(enqueueResult.apiKeyHash);

    return {
      reviewSpaceId,
      status: "queued",
      queueLength: enqueueResult.queueLength,
    };
  }
}
