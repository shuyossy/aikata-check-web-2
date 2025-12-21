import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import type { RuntimeContext } from "@mastra/core/di";
import {
  checklistRefinementAgent,
  checklistRefinementOutputSchema,
} from "../../../agents";
import { baseStepOutputSchema } from "../../schema";
import type { ChecklistGenerationWorkflowRuntimeContext } from "../types";
import { createRuntimeContext } from "../../../lib/agentUtils";
import { normalizeUnknownError, workflowError } from "@/lib/server/error";
import type { ChecklistRefinementAgentRuntimeContext } from "../../../agents";
import { getLogger } from "@/lib/server/logger";

const logger = getLogger();

/**
 * チェックリストブラッシュアップステップの入力スキーマ
 */
export const checklistRefinementInputSchema = z.object({
  systemChecklists: z.array(z.string()),
  checklistRequirements: z.string().optional(),
});

/**
 * チェックリストブラッシュアップステップの出力スキーマ
 */
export const checklistRefinementOutputStepSchema = baseStepOutputSchema.extend({
  refinedItems: z.array(z.string()).optional(),
});

export type ChecklistRefinementInput = z.infer<
  typeof checklistRefinementInputSchema
>;
export type ChecklistRefinementStepOutput = z.infer<
  typeof checklistRefinementOutputStepSchema
>;

/**
 * チェックリストブラッシュアップステップ
 * 抽出されたチェックリスト項目の重複削除・結合を行う
 */
export const checklistRefinementStep = createStep({
  id: "checklist-refinement",
  description:
    "抽出されたチェックリスト項目を重複削除・結合してブラッシュアップする",
  inputSchema: checklistRefinementInputSchema,
  outputSchema: checklistRefinementOutputStepSchema,
  execute: async ({
    inputData,
    runtimeContext: workflowRuntimeContext,
  }): Promise<ChecklistRefinementStepOutput> => {
    try {
      const { systemChecklists, checklistRequirements } = inputData;

      // チェックリストがない場合は成功で返す
      if (systemChecklists.length === 0) {
        return {
          status: "success",
          refinedItems: [],
        };
      }

      // workflowのRuntimeContextから設定を取得
      const typedWorkflowRuntimeContext = workflowRuntimeContext as
        | RuntimeContext<ChecklistGenerationWorkflowRuntimeContext>
        | undefined;
      const employeeId = typedWorkflowRuntimeContext?.get("employeeId");
      const projectApiKey = typedWorkflowRuntimeContext?.get("projectApiKey");
      const systemApiKey = typedWorkflowRuntimeContext?.get("systemApiKey");
      const systemApiUrl = typedWorkflowRuntimeContext?.get("systemApiUrl");
      const systemApiModel = typedWorkflowRuntimeContext?.get("systemApiModel");

      // これまでにブラッシュアップしたチェックリスト項目を蓄積する配列
      const accumulated: string[] = [];

      // 最大試行回数（トークン上限対策）
      const MAX_ATTEMPTS = 5;
      let attempts = 0;

      while (attempts < MAX_ATTEMPTS) {
        let isCompleted = true;

        // エージェント用のRuntimeContextを作成
        const runtimeContext =
          createRuntimeContext<ChecklistRefinementAgentRuntimeContext>({
            checklistRequirements,
            projectApiKey,
            employeeId,
            systemApiKey,
            systemApiUrl,
            systemApiModel,
          });

        // userプロンプトに全チェックリスト情報を含める
        const userPrompt = `ORIGINAL CHECKLIST ITEMS TO REFINE (${systemChecklists.length} items):
${systemChecklists.map((item, i) => `${i + 1}. ${item}`).join("\n")}

${
  accumulated.length > 0
    ? `ALREADY REFINED ITEMS (${accumulated.length} items):
${accumulated.map((item, i) => `${i + 1}. ${item}`).join("\n")}

Please continue refining the remaining items, avoiding duplicates with already refined items.`
    : "Please refine these checklist items according to the guidelines."
}`;

        const refinementResult = await checklistRefinementAgent.generateLegacy(
          { role: "user", content: userPrompt },
          {
            output: checklistRefinementOutputSchema,
            runtimeContext,
            // AIの限界生成トークン数を超えた場合のエラーを回避するための設定
            experimental_repairText: async (options) => {
              isCompleted = false;
              const { text } = options;
              let repairedText = text;
              let deleteLastItemFlag = false;
              try {
                const lastChar = text.charAt(text.length - 1);
                if (lastChar === '"') {
                  repairedText = text + "]}";
                } else if (lastChar === "]") {
                  repairedText = text + "}";
                } else if (lastChar === ",") {
                  // 最後のカンマを削除してから ]} を追加
                  repairedText = text.slice(0, -1) + "]}";
                } else {
                  // その他のケースでは強制的に "]} を追加
                  repairedText = text + '"]}';
                  deleteLastItemFlag = true;
                }
                // JSONに変換してみて、エラーが出ないか確かめる
                const parsedJson = JSON.parse(repairedText) as {
                  refinedChecklists: string[];
                };
                if (deleteLastItemFlag) {
                  parsedJson.refinedChecklists.pop(); // 最後の項目を削除
                }
                repairedText = JSON.stringify(parsedJson);
              } catch (error) {
                logger.error(
                  { err: error },
                  "チェックリストブラッシュアップの修正に失敗しました"
                );
                  throw workflowError(
                    "WORKFLOW_CHECKLIST_REFINEMENT_FAILED"
                  );
              }
              return repairedText;
            },
          }
        );

        // ブラッシュアップされたチェックリストから新規のものを蓄積
        const newRefinedItems =
          refinementResult.object.refinedChecklists?.filter(
            (item: string) => !accumulated.includes(item)
          ) || [];
        accumulated.push(...newRefinedItems);

        // 完了した場合はループを抜ける
        if (isCompleted) {
          break;
        }

        attempts++;
        if (attempts >= MAX_ATTEMPTS) {
          throw workflowError(
            "WORKFLOW_CHECKLIST_REFINEMENT_FAILED"
          );
        }
      }

      logger.debug(
        `チェックリストブラッシュアップ完了: ${systemChecklists.length}件 → ${accumulated.length}件`
      );

      return {
        status: "success",
        refinedItems: accumulated,
      };
    } catch (error) {
      const normalizedError = normalizeUnknownError(error);
      return {
        status: "failed",
        errorMessage: normalizedError.message,
      };
    }
  },
});
