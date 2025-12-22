import { createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { baseStepOutputSchema } from "../schema";
import { triggerSchema } from "./types";
import { topicExtractionStep } from "./steps/topicExtractionStep";
import { topicChecklistCreationStep } from "./steps/topicChecklistCreationStep";
import { checklistRefinementStep } from "./steps/checklistRefinementStep";
import { fileProcessingStep } from "../shared";

/**
 * チェックリスト生成ワークフローの出力スキーマ
 */
export const checklistGenerationOutputSchema = baseStepOutputSchema.extend({
  generatedItems: z.array(z.string()).optional(),
  totalCount: z.number().optional(),
});

export type ChecklistGenerationOutput = z.infer<
  typeof checklistGenerationOutputSchema
>;

/**
 * チェックリスト生成ワークフロー
 * ドキュメントからトピックを抽出し、各トピックに対してチェックリスト項目を生成する
 *
 * フロー:
 * 1. fileProcessingStep: バイナリファイルからテキスト抽出/画像Base64変換
 * 2. topicExtractionStep: ドキュメントからトピックを抽出
 * 3. .map(): トピック配列をforeachの入力形式に変換
 * 4. .foreach(topicChecklistCreationStep): 各トピックに対してチェックリスト項目を生成
 * 5. .map(): foreachの結果をchecklistRefinementStepの入力形式に変換
 * 6. checklistRefinementStep: チェックリスト項目をブラッシュアップ（重複削除・結合）
 * 7. .map(): 結果を統合して最終出力に変換
 */
export const checklistGenerationWorkflow = createWorkflow({
  id: "checklist-generation-workflow",
  inputSchema: triggerSchema,
  outputSchema: checklistGenerationOutputSchema,
})
  .map(async ({ inputData }) => {
    // fileProcessingStepの入力形式に変換（filesのみ）
    return { files: inputData.files };
  })
  .then(fileProcessingStep)
  .map(async ({ inputData, bail, getInitData }) => {
    // ファイル処理が失敗した場合は、bailで早期終了
    if (inputData.status === "failed") {
      return bail({
        status: "failed" as const,
        errorMessage: inputData.errorMessage || "ファイル処理に失敗しました",
      });
    }

    // 抽出されたファイルが空の場合
    if (!inputData.extractedFiles || inputData.extractedFiles.length === 0) {
      return bail({
        status: "failed" as const,
        errorMessage: "ファイルを処理できませんでした",
      });
    }

    // 元のトリガー入力からchecklistRequirementsを取得
    const initData = getInitData() as z.infer<typeof triggerSchema>;

    // topicExtractionStepの入力形式に変換
    return {
      files: inputData.extractedFiles,
      checklistRequirements: initData.checklistRequirements ?? "",
    };
  })
  .then(topicExtractionStep)
  .map(async ({ inputData, bail, getStepResult }) => {
    // トピック抽出が失敗した場合は、bailで早期終了
    if (inputData.status === "failed") {
      return bail({
        status: "failed" as const,
        errorMessage:
          inputData.errorMessage || "トピックを抽出できませんでした",
      });
    }

    // トピックが抽出されなかった場合
    if (!inputData.topics || inputData.topics.length === 0) {
      return bail({
        status: "failed" as const,
        errorMessage: "トピックを抽出できませんでした",
      });
    }

    // fileProcessingStepの結果からextractedFilesを取得
    const fileProcessingResult = getStepResult(fileProcessingStep);
    const extractedFiles = fileProcessingResult?.extractedFiles ?? [];

    // foreachの入力形式に変換（配列の各要素がtopicChecklistCreationStepの入力となる）
    return inputData.topics.map((topic) => ({
      topic,
      checklistRequirements: inputData.checklistRequirements,
      files: extractedFiles,
    }));
  })
  .foreach(topicChecklistCreationStep)
  .map(async ({ inputData, getInitData, bail }) => {
    // foreachの結果を統合してchecklistRefinementStepの入力形式に変換
    const allItems: string[] = [];
    let hasFailure = false;
    const errorMessages: string[] = [];

    // foreachの結果は配列として返される
    for (const result of inputData) {
      if (result.status === "failed") {
        hasFailure = true;
        if (result.errorMessage) {
          errorMessages.push(result.errorMessage);
        }
      } else if (result.checklistItems) {
        allItems.push(...result.checklistItems);
      }
    }

    // 全て失敗した場合はエラーを返す
    if (allItems.length === 0 && hasFailure) {
      return bail({
        status: "failed" as const,
        errorMessage: errorMessages.join("; "),
      });
    }

    // 結果が空の場合（foreachに何も渡されなかった場合）
    if (inputData.length === 0) {
      return bail({
        status: "failed" as const,
        errorMessage: "トピックを抽出できませんでした",
      });
    }

    // トピック抽出結果からchecklistRequirementsを取得
    const initData = getInitData() as z.infer<typeof triggerSchema>;
    const checklistRequirements = initData.checklistRequirements;

    // checklistRefinementStepの入力形式に変換
    return {
      systemChecklists: allItems,
      checklistRequirements,
    };
  })
  .then(checklistRefinementStep)
  .map(async ({ inputData }) => {
    // ブラッシュアップステップが失敗した場合
    if (inputData.status === "failed") {
      return {
        status: "failed" as const,
        errorMessage: inputData.errorMessage,
      };
    }

    // ブラッシュアップ後の項目がない場合
    if (!inputData.refinedItems || inputData.refinedItems.length === 0) {
      return {
        status: "failed" as const,
        errorMessage: "チェックリスト項目を生成できませんでした",
      };
    }

    return {
      status: "success" as const,
      generatedItems: inputData.refinedItems,
      totalCount: inputData.refinedItems.length,
    };
  })
  .commit();

export { triggerSchema } from "./types";
export type {
  TriggerInput,
  Topic,
  ChecklistGenerationWorkflowRuntimeContext,
} from "./types";
// shared typesも再エクスポート（ワークフロー利用者の便宜のため）
export {
  rawUploadFileMetaSchema,
  extractedFileSchema,
  FILE_BUFFERS_CONTEXT_KEY,
  type RawUploadFileMeta,
  type ExtractedFile,
  type FileBufferData,
  type FileBuffersMap,
} from "../shared";
