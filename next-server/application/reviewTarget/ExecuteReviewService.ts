import { IReviewTargetRepository } from "@/application/shared/port/repository/IReviewTargetRepository";
import { ICheckListItemRepository } from "@/application/shared/port/repository/ICheckListItemRepository";
import { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import {
  IProjectRepository,
  ISystemSettingRepository,
} from "@/application/shared/port/repository";
import { ReviewTarget } from "@/domain/reviewTarget";
import { ReviewSpaceId } from "@/domain/reviewSpace";
import { ProjectId } from "@/domain/project";
import { domainValidationError, internalError } from "@/lib/server/error";
import { getLogger } from "@/lib/server/logger";
import { AI_TASK_TYPE } from "@/domain/aiTask";
import {
  AiTaskQueueService,
  type FileInfoCommand,
} from "@/application/aiTask/AiTaskQueueService";
import { getAiTaskBootstrap } from "@/application/aiTask";
import type {
  RawUploadFileMeta,
  FileBuffersMap,
  EvaluationCriterion,
  ReviewType,
} from "@/application/mastra";
import type { ReviewTaskPayload } from "@/application/aiTask";
import { resolveAiApiConfig } from "@/application/shared/lib/resolveAiApiConfig";

const logger = getLogger();

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
 * レビュー実行結果DTO（キュー登録後）
 * 非同期処理のため、レビュー結果は含まない
 */
export interface ExecuteReviewResult {
  /** レビュー対象ID */
  reviewTargetId: string;
  /** ステータス（queued） */
  status: string;
  /** キュー内の待機タスク数 */
  queueLength: number;
}

/**
 * レビュー実行サービス
 * ドキュメントをチェックリストに基づいてAIレビューする
 * 非同期処理: タスクをキューに登録し、即座にレスポンスを返す
 */
export class ExecuteReviewService {
  constructor(
    private readonly reviewTargetRepository: IReviewTargetRepository,
    private readonly checkListItemRepository: ICheckListItemRepository,
    private readonly reviewSpaceRepository: IReviewSpaceRepository,
    private readonly projectRepository: IProjectRepository,
    private readonly systemSettingRepository: ISystemSettingRepository,
    private readonly aiTaskQueueService: AiTaskQueueService,
  ) {}

  /**
   * レビュー実行（キューに登録）
   * @param command 実行コマンド
   * @returns キュー登録結果
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
      reviewType,
    });

    // ステータスをqueuedに遷移
    const queuedTarget = reviewTarget.toQueued();

    // レビュー対象をDBに保存（ステータス: queued）
    await this.reviewTargetRepository.save(queuedTarget);

    // API設定を取得（プロジェクト設定 > 管理者設定 > 環境変数）
    const systemSetting = await this.systemSettingRepository.find();
    const aiApiConfig = resolveAiApiConfig(
      project.encryptedApiKey,
      systemSetting,
    );

    // ファイルバッファをFileInfoCommand配列に変換
    const fileCommands: FileInfoCommand[] = [];
    for (const file of files) {
      const bufferData = fileBuffers.get(file.id);
      if (!bufferData) {
        logger.warn(
          { fileId: file.id, fileName: file.name },
          "ファイルバッファが見つかりません",
        );
        continue;
      }

      // 画像モードの場合は変換済み画像のみを使用、テキストモードの場合は元ファイルを使用
      const processMode = file.processMode ?? "text";
      fileCommands.push({
        fileId: file.id,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        processMode,
        // テキストモード: 元ファイルのバッファ、画像モード: 空バッファ
        buffer: processMode === "text" ? bufferData.buffer : Buffer.alloc(0),
        // 画像モードの場合のみ変換済み画像を設定
        convertedImageBuffers:
          processMode === "image"
            ? bufferData.convertedImageBuffers
            : undefined,
      });
    }

    // チェックリスト項目をペイロード形式に変換
    const checkListItemsForPayload = checkListItems.map((item) => ({
      id: item.id.value,
      content: item.content.value,
    }));

    // タスクペイロードを作成
    const payload: ReviewTaskPayload = {
      reviewTargetId: queuedTarget.id.value,
      reviewSpaceId,
      userId,
      files,
      checkListItems: checkListItemsForPayload,
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
      aiApiConfig,
    };

    // タスクタイプを決定
    const taskType =
      reviewType === "large"
        ? AI_TASK_TYPE.LARGE_REVIEW
        : AI_TASK_TYPE.SMALL_REVIEW;

    // キューにタスクを登録
    const enqueueResult = await this.aiTaskQueueService.enqueueTask({
      taskType,
      apiKey: aiApiConfig.apiKey,
      payload: payload as unknown as Record<string, unknown>,
      files: fileCommands,
    });

    // ワーカーを開始（まだ開始されていない場合）
    const bootstrap = getAiTaskBootstrap();
    await bootstrap.startWorkersForApiKeyHash(enqueueResult.apiKeyHash);

    logger.info(
      {
        reviewTargetId: queuedTarget.id.value,
        taskId: enqueueResult.taskId,
        queueLength: enqueueResult.queueLength,
        reviewType,
      },
      "レビュータスクをキューに登録しました",
    );

    return {
      reviewTargetId: queuedTarget.id.value,
      status: queuedTarget.status.value,
      queueLength: enqueueResult.queueLength,
    };
  }
}
