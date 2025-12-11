"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { internalError, domainValidationError } from "@/lib/server/error";
import { ImportCheckListFromFileService } from "@/application/checkListItem";
import {
  ProjectRepository,
  ReviewSpaceRepository,
  UserRepository,
} from "@/infrastructure/adapter/db";
import { CheckListItemRepository } from "@/infrastructure/adapter/db/drizzle/repository/CheckListItemRepository";
import { FileTextExtractor } from "@/infrastructure/adapter/textExtractor";
import { EmployeeId } from "@/domain/user";
import { checkListImportConfig } from "@/lib/server/checkListImportConfig";

/**
 * FormDataをパースするためのスキーマ
 * FormDataは直接スキーマ検証できないため、パース済みのオブジェクトを検証する
 */
const importCheckListFromFileSchema = z.object({
  reviewSpaceId: z.string().uuid(),
  /** ファイルのバイナリデータ */
  fileBuffer: z.instanceof(Buffer),
  /** ファイル名 */
  fileName: z.string().min(1),
  /** ヘッダー行をスキップするか */
  skipHeaderRow: z.boolean(),
});

/**
 * FormDataからパラメータを抽出するヘルパー関数
 */
async function parseFormData(formData: FormData) {
  const reviewSpaceId = formData.get("reviewSpaceId");
  const file = formData.get("file");
  const skipHeaderRow = formData.get("skipHeaderRow");

  if (typeof reviewSpaceId !== "string") {
    throw domainValidationError("VALIDATION_ERROR");
  }

  if (!(file instanceof File)) {
    throw domainValidationError("VALIDATION_ERROR");
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const fileName = file.name;

  return {
    reviewSpaceId,
    fileBuffer,
    fileName,
    skipHeaderRow: skipHeaderRow === "true",
  };
}

/**
 * チェックリストファイルをインポートするアクション
 * FormDataでファイルを受け取り、バイナリデータとして処理する
 */
export const importCheckListFromFileAction = authenticatedAction
  .schema(z.instanceof(FormData))
  .action(async ({ parsedInput, ctx }) => {
    // FormDataからパラメータを抽出
    const params = await parseFormData(parsedInput);

    // パラメータを検証
    const validatedParams = importCheckListFromFileSchema.parse(params);

    // ファイルサイズチェック
    if (validatedParams.fileBuffer.length > checkListImportConfig.maxFileSizeBytes) {
      throw internalError({
        expose: true,
        messageCode: "CHECK_LIST_FILE_IMPORT_FILE_TOO_LARGE",
        messageParams: { maxSize: String(checkListImportConfig.maxFileSizeMB) },
      });
    }

    const userRepository = new UserRepository();
    const projectRepository = new ProjectRepository();
    const reviewSpaceRepository = new ReviewSpaceRepository();
    const checkListItemRepository = new CheckListItemRepository();
    const fileTextExtractor = new FileTextExtractor();

    // employeeIdからuserIdを取得
    const user = await userRepository.findByEmployeeId(
      EmployeeId.create(ctx.auth.employeeId),
    );

    if (!user) {
      throw internalError({ expose: true, messageCode: "USER_SYNC_FAILED" });
    }

    const service = new ImportCheckListFromFileService(
      fileTextExtractor,
      checkListItemRepository,
      reviewSpaceRepository,
      projectRepository,
    );

    const result = await service.execute({
      reviewSpaceId: validatedParams.reviewSpaceId,
      userId: user.id.value,
      fileBuffer: validatedParams.fileBuffer,
      fileName: validatedParams.fileName,
      options: {
        skipHeaderRow: validatedParams.skipHeaderRow,
      },
    });

    return result;
  });
