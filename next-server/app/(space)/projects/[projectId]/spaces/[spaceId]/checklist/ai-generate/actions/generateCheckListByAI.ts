"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { internalError, domainValidationError } from "@/lib/server/error";
import { GenerateCheckListByAIService } from "@/application/checkListItem";
import { AiTaskQueueService } from "@/application/aiTask";
import {
  rawUploadFileMetaSchema,
  type RawUploadFileMeta,
  type FileBuffersMap,
  type FileBufferData,
} from "@/application/mastra";
import {
  ProjectRepository,
  ReviewSpaceRepository,
  AiTaskRepository,
  AiTaskFileMetadataRepository,
  SystemSettingRepository,
} from "@/infrastructure/adapter/db";
import { fileUploadConfig } from "@/lib/server/fileUploadConfig";

/**
 * FormDataメタデータアイテムのスキーマ
 */
const formDataMetadataItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  size: z.number(),
  processMode: z.enum(["text", "image"]),
  convertedImageCount: z.number().optional(),
});

/**
 * AI生成の設定
 */
const aiGenerationConfig = {
  /** 最大ファイル数 */
  maxFiles: 10,
};

/**
 * FormDataからパラメータを抽出するヘルパー関数
 */
async function parseFormData(formData: FormData): Promise<{
  reviewSpaceId: string;
  checklistRequirements: string;
  files: RawUploadFileMeta[];
  fileBuffers: FileBuffersMap;
}> {
  const reviewSpaceId = formData.get("reviewSpaceId");
  const checklistRequirements = formData.get("checklistRequirements");
  const metadataJson = formData.get("metadata");

  // バリデーション
  if (typeof reviewSpaceId !== "string" || !reviewSpaceId) {
    throw domainValidationError("VALIDATION_ERROR");
  }

  if (typeof checklistRequirements !== "string" || !checklistRequirements) {
    throw domainValidationError("VALIDATION_ERROR");
  }

  if (typeof metadataJson !== "string" || !metadataJson) {
    throw domainValidationError("VALIDATION_ERROR");
  }

  // メタデータをパース
  let metadataArray: unknown[];
  try {
    metadataArray = JSON.parse(metadataJson);
  } catch {
    throw domainValidationError("VALIDATION_ERROR");
  }

  if (!Array.isArray(metadataArray) || metadataArray.length === 0) {
    throw internalError({
      expose: true,
      messageCode: "AI_CHECKLIST_GENERATION_NO_FILES",
    });
  }

  // ファイル数チェック
  if (metadataArray.length > aiGenerationConfig.maxFiles) {
    throw internalError({
      expose: true,
      messageCode: "AI_CHECKLIST_GENERATION_TOO_MANY_FILES",
      messageParams: { maxFiles: String(aiGenerationConfig.maxFiles) },
    });
  }

  const files: RawUploadFileMeta[] = [];
  const fileBuffers: FileBuffersMap = new Map();

  // 各ファイルを処理
  for (let i = 0; i < metadataArray.length; i++) {
    // メタデータをバリデーション
    const metadata = formDataMetadataItemSchema.parse(metadataArray[i]);

    // ファイルを取得
    const file = formData.get(`file_${i}`);
    if (!(file instanceof File)) {
      throw domainValidationError("VALIDATION_ERROR");
    }

    // ファイルサイズチェック
    if (file.size > fileUploadConfig.maxFileSizeBytes) {
      throw internalError({
        expose: true,
        messageCode: "CHECK_LIST_FILE_IMPORT_FILE_TOO_LARGE",
        messageParams: { maxSize: String(fileUploadConfig.maxFileSizeMB) },
      });
    }

    // バイナリデータを取得
    const buffer = Buffer.from(await file.arrayBuffer());

    // 変換済み画像を取得（存在する場合）
    const convertedImageBuffers: Buffer[] = [];
    if (metadata.convertedImageCount && metadata.convertedImageCount > 0) {
      for (let j = 0; j < metadata.convertedImageCount; j++) {
        const imageFile = formData.get(`file_${i}_image_${j}`);
        if (!(imageFile instanceof File)) {
          throw domainValidationError("VALIDATION_ERROR");
        }
        convertedImageBuffers.push(Buffer.from(await imageFile.arrayBuffer()));
      }
    }

    // RawUploadFileMetaを構築（zodスキーマでバリデーション）
    const rawFileMeta = rawUploadFileMetaSchema.parse({
      id: metadata.id,
      name: metadata.name,
      type: metadata.type,
      size: metadata.size,
      processMode: metadata.processMode,
      convertedImageCount: metadata.convertedImageCount,
    });

    files.push(rawFileMeta);

    // FileBufferDataを構築
    const bufferData: FileBufferData = {
      buffer,
      ...(convertedImageBuffers.length > 0 && { convertedImageBuffers }),
    };
    fileBuffers.set(metadata.id, bufferData);
  }

  return {
    reviewSpaceId,
    checklistRequirements,
    files,
    fileBuffers,
  };
}

/**
 * AIでチェックリストを生成するサーバーアクション
 * FormDataでファイルを受け取り、キューに登録して即座にレスポンスを返す
 */
export const generateCheckListByAIAction = authenticatedAction
  .schema(z.instanceof(FormData))
  .action(async ({ parsedInput, ctx }) => {
    // FormDataからパラメータを抽出
    const { reviewSpaceId, checklistRequirements, files, fileBuffers } =
      await parseFormData(parsedInput);

    // リポジトリの初期化
    const projectRepository = new ProjectRepository();
    const reviewSpaceRepository = new ReviewSpaceRepository();
    const aiTaskRepository = new AiTaskRepository();
    const aiTaskFileMetadataRepository = new AiTaskFileMetadataRepository();

    // キューサービスを作成
    const aiTaskQueueService = new AiTaskQueueService(
      aiTaskRepository,
      aiTaskFileMetadataRepository,
    );

    // サービスを実行（キューに登録）
    const systemSettingRepository = new SystemSettingRepository();
    const service = new GenerateCheckListByAIService(
      reviewSpaceRepository,
      projectRepository,
      systemSettingRepository,
      aiTaskQueueService,
    );

    const result = await service.execute({
      reviewSpaceId,
      userId: ctx.auth.userId,
      files,
      fileBuffers,
      checklistRequirements,
    });

    // キュー登録完了を返す（非同期処理なので生成結果は含まない）
    return {
      reviewSpaceId: result.reviewSpaceId,
      status: result.status,
      queueLength: result.queueLength,
    };
  });
