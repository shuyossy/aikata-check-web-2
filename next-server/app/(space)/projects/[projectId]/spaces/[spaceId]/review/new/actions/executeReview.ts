"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { internalError, domainValidationError } from "@/lib/server/error";
import { ExecuteReviewService } from "@/application/reviewTarget";
import {
  rawUploadFileMetaSchema,
  type RawUploadFileMeta,
  type FileBuffersMap,
  type FileBufferData,
  type EvaluationCriterion,
  type ReviewType,
} from "@/application/mastra";
import {
  ProjectRepository,
  ReviewSpaceRepository,
  UserRepository,
} from "@/infrastructure/adapter/db";
import { CheckListItemRepository } from "@/infrastructure/adapter/db/drizzle/repository/CheckListItemRepository";
import { ReviewTargetRepository, ReviewResultRepository } from "@/infrastructure/adapter/db";
import { EmployeeId } from "@/domain/user";
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
 * レビュー設定のスキーマ
 */
const reviewSettingsSchema = z.object({
  additionalInstructions: z.string().nullable().optional(),
  concurrentReviewItems: z.number().optional(),
  commentFormat: z.string().nullable().optional(),
  evaluationCriteria: z.array(z.object({
    label: z.string(),
    description: z.string(),
  })).optional(),
});

/**
 * レビュー実行の設定
 */
const reviewExecutionConfig = {
  /** 最大ファイル数 */
  maxFiles: 10,
};

/**
 * FormDataからパラメータを抽出するヘルパー関数
 */
async function parseFormData(formData: FormData): Promise<{
  reviewSpaceId: string;
  name: string;
  files: RawUploadFileMeta[];
  fileBuffers: FileBuffersMap;
  reviewSettings?: {
    additionalInstructions?: string | null;
    concurrentReviewItems?: number;
    commentFormat?: string | null;
    evaluationCriteria?: EvaluationCriterion[];
  };
  reviewType: ReviewType;
}> {
  const reviewSpaceId = formData.get("reviewSpaceId");
  const name = formData.get("name");
  const reviewTypeValue = formData.get("reviewType");
  const metadataJson = formData.get("metadata");
  const reviewSettingsJson = formData.get("reviewSettings");

  // バリデーション
  if (typeof reviewSpaceId !== "string" || !reviewSpaceId) {
    throw domainValidationError("VALIDATION_ERROR");
  }

  if (typeof name !== "string" || !name) {
    throw domainValidationError("VALIDATION_ERROR");
  }

  // レビュー種別のバリデーション（デフォルト: small）
  let reviewType: ReviewType = "small";
  if (typeof reviewTypeValue === "string" && reviewTypeValue) {
    if (reviewTypeValue !== "small" && reviewTypeValue !== "large") {
      throw domainValidationError("VALIDATION_ERROR");
    }
    reviewType = reviewTypeValue;
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
      messageCode: "REVIEW_EXECUTION_NO_FILES",
    });
  }

  // ファイル数チェック
  if (metadataArray.length > reviewExecutionConfig.maxFiles) {
    throw internalError({
      expose: true,
      messageCode: "FILE_UPLOAD_TOO_MANY_FILES",
      messageParams: { maxFiles: String(reviewExecutionConfig.maxFiles) },
    });
  }

  // レビュー設定をパース
  let reviewSettings: {
    additionalInstructions?: string | null;
    concurrentReviewItems?: number;
    commentFormat?: string | null;
    evaluationCriteria?: EvaluationCriterion[];
  } | undefined;

  if (typeof reviewSettingsJson === "string" && reviewSettingsJson) {
    try {
      const parsedSettings = JSON.parse(reviewSettingsJson);
      reviewSettings = reviewSettingsSchema.parse(parsedSettings);
    } catch {
      throw domainValidationError("VALIDATION_ERROR");
    }
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
    name,
    files,
    fileBuffers,
    reviewSettings,
    reviewType,
  };
}

/**
 * レビューを実行するサーバーアクション
 * FormDataでファイルを受け取り、バイナリデータとして処理する
 */
export const executeReviewAction = authenticatedAction
  .schema(z.instanceof(FormData))
  .action(async ({ parsedInput, ctx }) => {
    // FormDataからパラメータを抽出
    const { reviewSpaceId, name, files, fileBuffers, reviewSettings, reviewType } =
      await parseFormData(parsedInput);

    // リポジトリの初期化
    const userRepository = new UserRepository();
    const projectRepository = new ProjectRepository();
    const reviewSpaceRepository = new ReviewSpaceRepository();
    const checkListItemRepository = new CheckListItemRepository();
    const reviewTargetRepository = new ReviewTargetRepository();
    const reviewResultRepository = new ReviewResultRepository();

    // employeeIdからuserIdを取得
    const user = await userRepository.findByEmployeeId(
      EmployeeId.create(ctx.auth.employeeId),
    );

    if (!user) {
      throw internalError({ expose: true, messageCode: "USER_SYNC_FAILED" });
    }

    // サービスを実行
    const service = new ExecuteReviewService(
      reviewTargetRepository,
      reviewResultRepository,
      checkListItemRepository,
      reviewSpaceRepository,
      projectRepository,
    );

    const result = await service.execute({
      reviewSpaceId,
      name,
      userId: user.id.value,
      files,
      fileBuffers,
      reviewSettings,
      reviewType,
    });

    return {
      reviewTargetId: result.reviewTargetId,
      status: result.status,
      reviewResults: result.reviewResults,
    };
  });
