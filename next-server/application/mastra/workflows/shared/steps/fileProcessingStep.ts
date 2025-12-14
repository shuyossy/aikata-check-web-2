import { createStep } from "@mastra/core/workflows";
import type { RuntimeContext } from "@mastra/core/di";
import { z } from "zod";
import { baseStepOutputSchema } from "../../schema";
import {
  rawUploadFileMetaSchema,
  extractedFileSchema,
  FILE_BUFFERS_CONTEXT_KEY,
  type RawUploadFileMeta,
  type ExtractedFile,
  type FileBuffersMap,
  type FileBufferData,
} from "../types";
import { FileTextExtractor } from "@/infrastructure/adapter/textExtractor";
import { normalizeUnknownError } from "@/lib/server/error";
import { getLogger } from "@/lib/server/logger";

/**
 * ファイル処理ステップの入力スキーマ
 * checklistRequirementsはチェックリスト生成ワークフロー用（オプション）
 */
export const fileProcessingInputSchema = z.object({
  files: z.array(rawUploadFileMetaSchema),
  checklistRequirements: z.string().optional(),
});

/**
 * ファイル処理ステップの出力スキーマ
 */
export const fileProcessingOutputSchema = baseStepOutputSchema.extend({
  extractedFiles: z.array(extractedFileSchema).optional(),
  checklistRequirements: z.string().optional(),
});

export type FileProcessingInput = z.infer<typeof fileProcessingInputSchema>;
export type FileProcessingOutput = z.infer<typeof fileProcessingOutputSchema>;

/**
 * RuntimeContextからファイルバッファを取得する際の型
 */
interface FileProcessingRuntimeContext {
  [FILE_BUFFERS_CONTEXT_KEY]?: FileBuffersMap;
}

/**
 * ファイル処理ステップ
 * バイナリファイルからテキスト抽出/画像Base64変換を行う共通ステップ
 *
 * - text mode: FileTextExtractorでテキスト抽出
 * - image mode: BufferからBase64文字列に変換
 *
 * このステップはレビュー実行でも再利用可能
 */
export const fileProcessingStep = createStep({
  id: "file-processing",
  description: "ファイルからテキスト抽出/画像変換を行う",
  inputSchema: fileProcessingInputSchema,
  outputSchema: fileProcessingOutputSchema,
  execute: async ({
    inputData,
    runtimeContext: workflowRuntimeContext,
  }): Promise<FileProcessingOutput> => {
    const logger = getLogger();
    const fileTextExtractor = new FileTextExtractor();

    try {
      const { files, checklistRequirements } = inputData;

      // RuntimeContextからファイルバッファを取得
      const typedRuntimeContext = workflowRuntimeContext as
        | RuntimeContext<FileProcessingRuntimeContext>
        | undefined;

      const fileBuffers = typedRuntimeContext?.get(FILE_BUFFERS_CONTEXT_KEY) as
        | FileBuffersMap
        | undefined;

      if (!fileBuffers) {
        return {
          status: "failed",
          errorMessage:
            "RuntimeContextにファイルバッファが設定されていません",
        };
      }

      const extractedFiles: ExtractedFile[] = [];

      for (const fileMeta of files) {
        const bufferData = fileBuffers.get(fileMeta.id);

        if (!bufferData) {
          logger.error(
            { fileName: fileMeta.name, fileId: fileMeta.id },
            "ファイルバッファが見つかりません",
          );
          return {
            status: "failed",
            errorMessage: `ファイル「${fileMeta.name}」のバッファが見つかりません`,
          };
        }

        try {
          if (fileMeta.processMode === "image") {
            // 画像モード: Buffer → Base64変換
            const imageData = processImageMode(bufferData, fileMeta);
            extractedFiles.push({
              id: fileMeta.id,
              name: fileMeta.name,
              type: fileMeta.type,
              processMode: "image",
              imageData,
            });
          } else {
            // テキストモード: FileTextExtractorでテキスト抽出
            const textContent = await processTextMode(
              bufferData,
              fileMeta,
              fileTextExtractor,
            );
            extractedFiles.push({
              id: fileMeta.id,
              name: fileMeta.name,
              type: fileMeta.type,
              processMode: "text",
              textContent,
            });
          }
        } catch (fileError) {
          const normalizedError = normalizeUnknownError(fileError);
          logger.error(
            { fileName: fileMeta.name, err: normalizedError },
            "ファイル処理でエラー発生",
          );
          return {
            status: "failed",
            errorMessage: `ファイル「${fileMeta.name}」の処理に失敗しました: ${normalizedError.message}`,
          };
        }
      }

      return {
        status: "success",
        extractedFiles,
        checklistRequirements,
      };
    } catch (error) {
      const normalizedError = normalizeUnknownError(error);
      logger.error(
        { err: normalizedError },
        "ファイル処理ステップでエラー発生",
      );
      return {
        status: "failed",
        errorMessage: normalizedError.message,
      };
    }
  },
});

/**
 * 画像モードの処理
 * convertedImageBuffersをBase64文字列に変換
 */
function processImageMode(
  bufferData: FileBufferData,
  fileMeta: RawUploadFileMeta,
): string[] {
  const imageData: string[] = [];

  if (bufferData.convertedImageBuffers && bufferData.convertedImageBuffers.length > 0) {
    // PDF画像変換済みの場合はconvertedImageBuffersを使用
    for (const imageBuffer of bufferData.convertedImageBuffers) {
      imageData.push(imageBuffer.toString("base64"));
    }
  } else {
    // convertedImageBuffersがない場合は元のバッファを使用（単一画像ファイルの場合など）
    imageData.push(bufferData.buffer.toString("base64"));
  }

  return imageData;
}

/**
 * テキストモードの処理
 * FileTextExtractorでバイナリからテキスト抽出
 */
async function processTextMode(
  bufferData: FileBufferData,
  fileMeta: RawUploadFileMeta,
  fileTextExtractor: FileTextExtractor,
): Promise<string> {
  // FileTextExtractorでテキスト抽出（正規化も含む）
  const textContent = await fileTextExtractor.extract(
    bufferData.buffer,
    fileMeta.name,
  );
  return textContent;
}
