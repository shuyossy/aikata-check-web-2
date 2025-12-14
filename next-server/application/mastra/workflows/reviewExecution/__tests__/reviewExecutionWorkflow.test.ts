/**
 * レビュー実行ワークフローのテスト
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RuntimeContext } from "@mastra/core/di";
import { reviewExecutionWorkflow } from "../index";
import { checkWorkflowResult } from "../../../lib/workflowUtils";
import type { RawUploadFileMeta } from "../../shared";
import type { CheckListItem, EvaluationCriterion } from "../types";

// vi.hoistedを使ってモック関数をホイスト（vi.mockより先に宣言される）
const {
  mockReviewExecuteAgentGenerateLegacy,
  mockFileProcessingStep,
  mockChecklistCategoryAgentGenerateLegacy,
} = vi.hoisted(() => ({
  mockReviewExecuteAgentGenerateLegacy: vi.fn(),
  mockFileProcessingStep: vi.fn(),
  mockChecklistCategoryAgentGenerateLegacy: vi.fn(),
}));

// エージェントのモック設定
vi.mock("../../../agents", () => ({
  reviewExecuteAgent: {
    generateLegacy: (...args: unknown[]) =>
      mockReviewExecuteAgentGenerateLegacy(...args),
  },
  reviewExecuteOutputSchema: {
    parse: vi.fn((v: unknown) => v),
  },
  checklistCategoryAgent: {
    generateLegacy: (...args: unknown[]) =>
      mockChecklistCategoryAgentGenerateLegacy(...args),
  },
  checklistCategoryOutputSchema: {
    parse: vi.fn((v: unknown) => v),
  },
}));

// fileProcessingStepをモック
// workflowテストではfileProcessingStepの内部実装をテストしないため、モックで代替
vi.mock("../../shared", async () => {
  const actual =
    await vi.importActual<typeof import("../../shared")>("../../shared");
  return {
    ...actual,
    fileProcessingStep: {
      id: "file-processing",
      description: "ファイルからテキスト抽出/画像変換を行う",
      inputSchema: actual.fileProcessingInputSchema,
      outputSchema: actual.fileProcessingOutputSchema,
      execute: mockFileProcessingStep,
    },
  };
});

describe("reviewExecutionWorkflow", () => {
  // テストデータ: RawUploadFileMeta形式
  const testFiles: RawUploadFileMeta[] = [
    {
      id: "file-1",
      name: "test-document.txt",
      type: "text/plain",
      size: 1000,
      processMode: "text",
    },
  ];

  // テストデータ: チェックリスト項目
  const testCheckListItems: CheckListItem[] = [
    { id: "check-1", content: "セキュリティ要件を満たしているか" },
    { id: "check-2", content: "エラーハンドリングが適切か" },
    { id: "check-3", content: "パフォーマンス要件を満たしているか" },
  ];

  // テストデータ: 評価基準
  const testEvaluationCriteria: EvaluationCriterion[] = [
    { label: "A", description: "要件を完全に満たしている" },
    { label: "B", description: "概ね要件を満たしている" },
    { label: "C", description: "改善が必要" },
    { label: "-", description: "評価対象外" },
  ];

  // RuntimeContextを作成するヘルパー関数
  const createTestRuntimeContext = () => {
    const runtimeContext = new RuntimeContext();
    runtimeContext.set("employeeId", "test-user-id");
    runtimeContext.set("projectApiKey", "test-api-key");
    return runtimeContext;
  };

  // fileProcessingStepのデフォルトモック戻り値を設定
  const setupDefaultFileProcessingMock = () => {
    mockFileProcessingStep.mockResolvedValue({
      status: "success",
      extractedFiles: [
        {
          id: "file-1",
          name: "test-document.txt",
          type: "text/plain",
          processMode: "text",
          textContent: "テストドキュメントの内容",
        },
      ],
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultFileProcessingMock();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("正常系", () => {
    it("全てのチェック項目のレビューが成功すること", async () => {
      // Arrange: AIはショートID（1始まりの連番）を返す
      mockReviewExecuteAgentGenerateLegacy.mockResolvedValue({
        finishReason: "stop",
        object: [
          {
            checklistId: 1, // check-1のショートID
            reviewSections: [{ fileName: "test.txt", sectionNames: ["intro"] }],
            comment: "セキュリティ要件を満たしています",
            evaluation: "A",
          },
          {
            checklistId: 2, // check-2のショートID
            reviewSections: [{ fileName: "test.txt", sectionNames: ["error"] }],
            comment: "エラーハンドリングは適切です",
            evaluation: "A",
          },
          {
            checklistId: 3, // check-3のショートID
            reviewSections: [{ fileName: "test.txt", sectionNames: ["perf"] }],
            comment: "パフォーマンス要件を満たしています",
            evaluation: "B",
          },
        ],
      });

      // Act
      const run = await reviewExecutionWorkflow.createRunAsync();
      const result = await run.start({
        inputData: {
          files: testFiles,
          checkListItems: testCheckListItems,
          reviewSettings: {
            evaluationCriteria: testEvaluationCriteria,
          },
        },
        runtimeContext: createTestRuntimeContext(),
      });

      // Assert
      const checkResult = checkWorkflowResult(result);
      expect(checkResult.status).toBe("success");
      expect(mockReviewExecuteAgentGenerateLegacy).toHaveBeenCalledTimes(1);

      // 結果の検証
      if (result.status === "success") {
        const workflowResult = result.result as {
          status: string;
          reviewResults?: Array<{
            checkListItemContent: string;
            evaluation: string | null;
            comment: string | null;
            errorMessage: string | null;
          }>;
        };
        expect(workflowResult.status).toBe("success");
        expect(workflowResult.reviewResults).toHaveLength(3);
        expect(
          workflowResult.reviewResults?.find(
            (r) => r.checkListItemContent === "セキュリティ要件を満たしているか"
          )
        ).toEqual({
          checkListItemContent: "セキュリティ要件を満たしているか",
          evaluation: "A",
          comment: "セキュリティ要件を満たしています",
          errorMessage: null,
        });
      }
    });

    it("追加指示とコメントフォーマットがエージェントに渡されること", async () => {
      // Arrange: AIはショートID（1始まりの連番）を返す
      mockReviewExecuteAgentGenerateLegacy.mockResolvedValue({
        finishReason: "stop",
        object: [
          {
            checklistId: 1, // check-1のショートID
            reviewSections: [],
            comment: "テストコメント",
            evaluation: "A",
          },
        ],
      });

      const additionalInstructions = "厳格にレビューしてください";
      const commentFormat = "【問題点】\n【改善案】";

      // Act
      const run = await reviewExecutionWorkflow.createRunAsync();
      await run.start({
        inputData: {
          files: testFiles,
          checkListItems: [testCheckListItems[0]],
          reviewSettings: {
            additionalInstructions,
            commentFormat,
            evaluationCriteria: testEvaluationCriteria,
          },
        },
        runtimeContext: createTestRuntimeContext(),
      });

      // Assert
      expect(mockReviewExecuteAgentGenerateLegacy).toHaveBeenCalledTimes(1);
      const callArgs = mockReviewExecuteAgentGenerateLegacy.mock.calls[0];
      const options = callArgs[1];
      const runtimeContext = options.runtimeContext;

      // RuntimeContextに設定が含まれていることを確認
      expect(runtimeContext.get("additionalInstructions")).toBe(
        additionalInstructions
      );
      expect(runtimeContext.get("commentFormat")).toBe(commentFormat);
    });

    it("一部のチェック項目がリトライで成功すること", async () => {
      // Arrange: 1回目は2項目のみ、2回目で残り1項目がレビューされる
      // AIはショートID（1始まりの連番）を返す
      mockReviewExecuteAgentGenerateLegacy
        .mockResolvedValueOnce({
          finishReason: "stop",
          object: [
            {
              checklistId: 1, // check-1のショートID
              reviewSections: [],
              comment: "コメント1",
              evaluation: "A",
            },
            {
              checklistId: 2, // check-2のショートID
              reviewSections: [],
              comment: "コメント2",
              evaluation: "B",
            },
            // check-3（ショートID: 3）がない
          ],
        })
        .mockResolvedValueOnce({
          finishReason: "stop",
          object: [
            {
              checklistId: 1, // リトライ時は残り1項目のみなのでショートID: 1
              reviewSections: [],
              comment: "コメント3",
              evaluation: "A",
            },
          ],
        });

      // Act
      const run = await reviewExecutionWorkflow.createRunAsync();
      const result = await run.start({
        inputData: {
          files: testFiles,
          checkListItems: testCheckListItems,
          reviewSettings: {
            evaluationCriteria: testEvaluationCriteria,
          },
        },
        runtimeContext: createTestRuntimeContext(),
      });

      // Assert
      const checkResult = checkWorkflowResult(result);
      expect(checkResult.status).toBe("success");
      // リトライが発生するので2回呼ばれる
      expect(mockReviewExecuteAgentGenerateLegacy).toHaveBeenCalledTimes(2);

      if (result.status === "success") {
        const workflowResult = result.result as {
          status: string;
          reviewResults?: Array<{
            checkListItemContent: string;
            evaluation: string | null;
            comment: string | null;
            errorMessage: string | null;
          }>;
        };
        expect(workflowResult.reviewResults).toHaveLength(3);
      }
    });

    it("デフォルト評価基準（A/B/C/-）が使用されること", async () => {
      // Arrange: 評価基準を指定しない場合
      // AIはショートID（1始まりの連番）を返す
      mockReviewExecuteAgentGenerateLegacy.mockResolvedValue({
        finishReason: "stop",
        object: [
          {
            checklistId: 1, // check-1のショートID
            reviewSections: [],
            comment: "コメント",
            evaluation: "A", // デフォルト評価基準
          },
        ],
      });

      // Act
      const run = await reviewExecutionWorkflow.createRunAsync();
      const result = await run.start({
        inputData: {
          files: testFiles,
          checkListItems: [testCheckListItems[0]],
          // evaluationCriteriaを指定しない
        },
        runtimeContext: createTestRuntimeContext(),
      });

      // Assert
      const checkResult = checkWorkflowResult(result);
      expect(checkResult.status).toBe("success");
    });
  });

  describe("異常系", () => {
    it("fileProcessingStepが失敗した場合にworkflowが失敗すること", async () => {
      // Arrange: fileProcessingStepが失敗するようにモック
      mockFileProcessingStep.mockResolvedValue({
        status: "failed",
        errorMessage: "ファイル処理エラー",
      });

      // Act
      const run = await reviewExecutionWorkflow.createRunAsync();
      const result = await run.start({
        inputData: {
          files: testFiles,
          checkListItems: testCheckListItems,
        },
        runtimeContext: createTestRuntimeContext(),
      });

      // Assert
      const checkResult = checkWorkflowResult(result);
      expect(checkResult.status).toBe("failed");
      expect(checkResult.errorMessage).toContain("ファイル処理");

      // エージェントは呼ばれない
      expect(mockReviewExecuteAgentGenerateLegacy).not.toHaveBeenCalled();
    });

    it("抽出ファイルが空の場合にworkflowが失敗すること", async () => {
      // Arrange
      mockFileProcessingStep.mockResolvedValue({
        status: "success",
        extractedFiles: [],
      });

      // Act
      const run = await reviewExecutionWorkflow.createRunAsync();
      const result = await run.start({
        inputData: {
          files: testFiles,
          checkListItems: testCheckListItems,
        },
        runtimeContext: createTestRuntimeContext(),
      });

      // Assert
      const checkResult = checkWorkflowResult(result);
      expect(checkResult.status).toBe("failed");
      expect(checkResult.errorMessage).toContain("ファイルを処理できません");
    });

    it("AIエラー時でもworkflowが成功し、各チェック項目にエラーが記録されること", async () => {
      // Arrange: AI APIが例外をスローする
      mockReviewExecuteAgentGenerateLegacy.mockRejectedValue(
        new Error("AI APIエラー")
      );

      // Act
      const run = await reviewExecutionWorkflow.createRunAsync();
      const result = await run.start({
        inputData: {
          files: testFiles,
          checkListItems: testCheckListItems,
        },
        runtimeContext: createTestRuntimeContext(),
      });

      // Assert: workflowは全チェック項目がエラーなので失敗
      // ただし、reviewResultsには各チェック項目のエラー結果が含まれる
      const checkResult = checkWorkflowResult(result);
      expect(checkResult.status).toBe("failed");

      if (result.status === "success") {
        const workflowResult = result.result as {
          status: string;
          reviewResults?: Array<{
            checkListItemContent: string;
            evaluation: string | null;
            comment: string | null;
            errorMessage: string | null;
          }>;
        };
        // 全チェック項目にエラー結果が作成される
        expect(workflowResult.reviewResults).toHaveLength(3);
        // 全てにエラーメッセージが設定されている
        for (const r of workflowResult.reviewResults ?? []) {
          // エラーメッセージが存在することを確認（normalizeUnknownErrorにより変換される可能性がある）
          expect(r.errorMessage).toBeTruthy();
          expect(r.evaluation).toBeNull();
          expect(r.comment).toBeNull();
        }
      }
    });

    it("一部チャンクでAIエラーが発生しても他のチャンクが成功すればworkflowは成功すること", async () => {
      // Arrange: AIカテゴリ分類で2チャンクに分割、1チャンク目は成功、2チャンク目は失敗
      // AIはショートID（1始まりの連番）を返す
      mockChecklistCategoryAgentGenerateLegacy.mockResolvedValue({
        finishReason: "stop",
        object: {
          categories: [
            { name: "セキュリティ", checklistIds: [1] }, // check-1のショートID
            { name: "その他", checklistIds: [2, 3] }, // check-2, 3のショートID
          ],
        },
      });

      // 1チャンク目は成功、2チャンク目は例外
      mockReviewExecuteAgentGenerateLegacy
        .mockResolvedValueOnce({
          finishReason: "stop",
          object: [
            {
              checklistId: 1, // チャンク内でのショートID
              reviewSections: [],
              comment: "コメント1",
              evaluation: "A",
            },
          ],
        })
        .mockRejectedValueOnce(new Error("AI APIエラー（2チャンク目）"));

      // Act
      const run = await reviewExecutionWorkflow.createRunAsync();
      const result = await run.start({
        inputData: {
          files: testFiles,
          checkListItems: testCheckListItems,
          reviewSettings: {
            concurrentReviewItems: 2,
            evaluationCriteria: testEvaluationCriteria,
          },
        },
        runtimeContext: createTestRuntimeContext(),
      });

      // Assert: 一部成功があるのでworkflow全体は成功
      const checkResult = checkWorkflowResult(result);
      expect(checkResult.status).toBe("success");

      if (result.status === "success") {
        const workflowResult = result.result as {
          status: string;
          reviewResults?: Array<{
            checkListItemContent: string;
            evaluation: string | null;
            comment: string | null;
            errorMessage: string | null;
          }>;
        };

        // 全チェック項目の結果がある
        expect(workflowResult.reviewResults).toHaveLength(3);

        // check-1は成功
        const check1Result = workflowResult.reviewResults?.find(
          (r) => r.checkListItemContent === "セキュリティ要件を満たしているか"
        );
        expect(check1Result?.evaluation).toBe("A");
        expect(check1Result?.errorMessage).toBeNull();

        // check-2, check-3はエラー（エラーメッセージが存在することを確認）
        const check2Result = workflowResult.reviewResults?.find(
          (r) => r.checkListItemContent === "エラーハンドリングが適切か"
        );
        expect(check2Result?.errorMessage).toBeTruthy();
        expect(check2Result?.evaluation).toBeNull();

        const check3Result = workflowResult.reviewResults?.find(
          (r) => r.checkListItemContent === "パフォーマンス要件を満たしているか"
        );
        expect(check3Result?.errorMessage).toBeTruthy();
        expect(check3Result?.evaluation).toBeNull();
      }
    });

    it("最大リトライ回数到達後も未レビュー項目があればエラーとして記録すること", async () => {
      // Arrange: 常にcheck-3がレビューされない
      // AIはショートID（1始まりの連番）を返す
      // 1回目: 3項目中、ショートID 1, 2を返す（check-1, check-2がレビューされる）→ check-3が残る
      // 2回目: 1項目中、空配列を返す（check-3がレビューされない）
      // 3回目: 1項目中、空配列を返す（check-3がレビューされない）
      mockReviewExecuteAgentGenerateLegacy
        .mockResolvedValueOnce({
          finishReason: "stop",
          object: [
            {
              checklistId: 1, // check-1のショートID
              reviewSections: [],
              comment: "コメント1",
              evaluation: "A",
            },
            {
              checklistId: 2, // check-2のショートID
              reviewSections: [],
              comment: "コメント2",
              evaluation: "B",
            },
            // check-3（ショートID: 3）が含まれない
          ],
        })
        .mockResolvedValueOnce({
          finishReason: "stop",
          object: [], // リトライ1回目: check-3のみだがレビューされない
        })
        .mockResolvedValueOnce({
          finishReason: "stop",
          object: [], // リトライ2回目: check-3のみだがレビューされない
        });

      // Act
      const run = await reviewExecutionWorkflow.createRunAsync();
      const result = await run.start({
        inputData: {
          files: testFiles,
          checkListItems: testCheckListItems,
        },
        runtimeContext: createTestRuntimeContext(),
      });

      // Assert
      const checkResult = checkWorkflowResult(result);
      expect(checkResult.status).toBe("success"); // 部分的成功

      if (result.status === "success") {
        const workflowResult = result.result as {
          status: string;
          reviewResults?: Array<{
            checkListItemContent: string;
            evaluation: string | null;
            comment: string | null;
            errorMessage: string | null;
          }>;
        };
        // 3つ全ての結果がある（2つ成功、1つエラー）
        expect(workflowResult.reviewResults).toHaveLength(3);

        // check-3はエラーとして記録
        const check3Result = workflowResult.reviewResults?.find(
          (r) => r.checkListItemContent === "パフォーマンス要件を満たしているか"
        );
        expect(check3Result?.errorMessage).toBeTruthy();
        expect(check3Result?.evaluation).toBeNull();
      }
    });

    it("全てのチェック項目がエラーの場合はworkflowが失敗すること", async () => {
      // Arrange: 常に空配列を返す
      mockReviewExecuteAgentGenerateLegacy.mockResolvedValue({
        finishReason: "stop",
        object: [],
      });

      // Act
      const run = await reviewExecutionWorkflow.createRunAsync();
      const result = await run.start({
        inputData: {
          files: testFiles,
          checkListItems: testCheckListItems,
        },
        runtimeContext: createTestRuntimeContext(),
      });

      // Assert
      const checkResult = checkWorkflowResult(result);
      expect(checkResult.status).toBe("failed");
      expect(checkResult.errorMessage).toContain(
        "全てのチェック項目のレビューに失敗"
      );
    });
  });

  describe("画像モードのテスト", () => {
    it("画像モードのファイルも処理できること", async () => {
      // Arrange: fileProcessingStepが画像ファイルを処理した結果をモック
      mockFileProcessingStep.mockResolvedValue({
        status: "success",
        extractedFiles: [
          {
            id: "file-1",
            name: "document.pdf",
            type: "application/pdf",
            processMode: "image",
            imageData: ["base64encodedimage1", "base64encodedimage2"],
          },
        ],
      });

      const imageFiles: RawUploadFileMeta[] = [
        {
          id: "file-1",
          name: "document.pdf",
          type: "application/pdf",
          size: 5000,
          processMode: "image",
          convertedImageCount: 2,
        },
      ];

      // AIはショートID（1始まりの連番）を返す
      mockReviewExecuteAgentGenerateLegacy.mockResolvedValue({
        finishReason: "stop",
        object: [
          {
            checklistId: 1, // check-1のショートID
            reviewSections: [],
            comment: "画像からレビュー",
            evaluation: "A",
          },
        ],
      });

      // Act
      const run = await reviewExecutionWorkflow.createRunAsync();
      const result = await run.start({
        inputData: {
          files: imageFiles,
          checkListItems: [testCheckListItems[0]],
        },
        runtimeContext: createTestRuntimeContext(),
      });

      // Assert
      const checkResult = checkWorkflowResult(result);
      expect(checkResult.status).toBe("success");

      // generateLegacyに渡されたメッセージを確認
      const callArgs = mockReviewExecuteAgentGenerateLegacy.mock.calls[0];
      const message = callArgs[0];
      expect(message.content).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "image",
          }),
        ])
      );
    });
  });

  describe("concurrentReviewItemsのテスト", () => {
    it("concurrentReviewItems=1の場合、チェック項目が個別にレビューされること", async () => {
      // Arrange: 各チェック項目ごとに個別のレビュー結果を返す
      // AIはショートID（1始まりの連番）を返す。各チャンクは1件なのでショートID: 1
      mockReviewExecuteAgentGenerateLegacy
        .mockResolvedValueOnce({
          finishReason: "stop",
          object: [
            {
              checklistId: 1, // チャンク内でのショートID
              reviewSections: [],
              comment: "コメント1",
              evaluation: "A",
            },
          ],
        })
        .mockResolvedValueOnce({
          finishReason: "stop",
          object: [
            {
              checklistId: 1, // チャンク内でのショートID
              reviewSections: [],
              comment: "コメント2",
              evaluation: "B",
            },
          ],
        })
        .mockResolvedValueOnce({
          finishReason: "stop",
          object: [
            {
              checklistId: 1, // チャンク内でのショートID
              reviewSections: [],
              comment: "コメント3",
              evaluation: "A",
            },
          ],
        });

      // Act
      const run = await reviewExecutionWorkflow.createRunAsync();
      const result = await run.start({
        inputData: {
          files: testFiles,
          checkListItems: testCheckListItems,
          reviewSettings: {
            concurrentReviewItems: 1,
            evaluationCriteria: testEvaluationCriteria,
          },
        },
        runtimeContext: createTestRuntimeContext(),
      });

      // Assert
      const checkResult = checkWorkflowResult(result);
      expect(checkResult.status).toBe("success");

      // 3つのチェック項目に対して3回呼ばれる（各1件ずつ）
      expect(mockReviewExecuteAgentGenerateLegacy).toHaveBeenCalledTimes(3);

      if (result.status === "success") {
        const workflowResult = result.result as {
          status: string;
          reviewResults?: Array<{
            checkListItemContent: string;
            evaluation: string | null;
            comment: string | null;
            errorMessage: string | null;
          }>;
        };
        expect(workflowResult.reviewResults).toHaveLength(3);
      }
    });

    it("concurrentReviewItems未指定の場合、全項目が一括でレビューされること", async () => {
      // Arrange: AIはショートID（1始まりの連番）を返す
      mockReviewExecuteAgentGenerateLegacy.mockResolvedValue({
        finishReason: "stop",
        object: [
          {
            checklistId: 1, // check-1のショートID
            reviewSections: [],
            comment: "コメント1",
            evaluation: "A",
          },
          {
            checklistId: 2, // check-2のショートID
            reviewSections: [],
            comment: "コメント2",
            evaluation: "B",
          },
          {
            checklistId: 3, // check-3のショートID
            reviewSections: [],
            comment: "コメント3",
            evaluation: "A",
          },
        ],
      });

      // Act
      const run = await reviewExecutionWorkflow.createRunAsync();
      const result = await run.start({
        inputData: {
          files: testFiles,
          checkListItems: testCheckListItems,
          reviewSettings: {
            // concurrentReviewItems未指定
            evaluationCriteria: testEvaluationCriteria,
          },
        },
        runtimeContext: createTestRuntimeContext(),
      });

      // Assert
      const checkResult = checkWorkflowResult(result);
      expect(checkResult.status).toBe("success");

      // 1回だけ呼ばれる（全項目一括）
      expect(mockReviewExecuteAgentGenerateLegacy).toHaveBeenCalledTimes(1);

      if (result.status === "success") {
        const workflowResult = result.result as {
          status: string;
          reviewResults?: Array<{
            checkListItemContent: string;
            evaluation: string | null;
            comment: string | null;
            errorMessage: string | null;
          }>;
        };
        expect(workflowResult.reviewResults).toHaveLength(3);
      }
    });

    it("concurrentReviewItems>=2の場合、AIカテゴリ分類が実行されること", async () => {
      // Arrange: AIカテゴリ分類結果（ショートID使用）
      mockChecklistCategoryAgentGenerateLegacy.mockResolvedValue({
        finishReason: "stop",
        object: {
          categories: [
            {
              name: "セキュリティ",
              checklistIds: [1], // check-1のショートID
            },
            {
              name: "その他",
              checklistIds: [2, 3], // check-2, 3のショートID
            },
          ],
        },
      });

      // 各チャンクのレビュー結果（チャンク内でのショートID）
      mockReviewExecuteAgentGenerateLegacy
        .mockResolvedValueOnce({
          finishReason: "stop",
          object: [
            {
              checklistId: 1, // チャンク内でのショートID
              reviewSections: [],
              comment: "コメント1",
              evaluation: "A",
            },
          ],
        })
        .mockResolvedValueOnce({
          finishReason: "stop",
          object: [
            {
              checklistId: 1, // チャンク内でのショートID（check-2）
              reviewSections: [],
              comment: "コメント2",
              evaluation: "B",
            },
            {
              checklistId: 2, // チャンク内でのショートID（check-3）
              reviewSections: [],
              comment: "コメント3",
              evaluation: "A",
            },
          ],
        });

      // Act
      const run = await reviewExecutionWorkflow.createRunAsync();
      const result = await run.start({
        inputData: {
          files: testFiles,
          checkListItems: testCheckListItems,
          reviewSettings: {
            concurrentReviewItems: 2,
            evaluationCriteria: testEvaluationCriteria,
          },
        },
        runtimeContext: createTestRuntimeContext(),
      });

      // Assert
      const checkResult = checkWorkflowResult(result);
      expect(checkResult.status).toBe("success");

      // AIカテゴリ分類が呼ばれる
      expect(mockChecklistCategoryAgentGenerateLegacy).toHaveBeenCalledTimes(1);

      // 2つのチャンク（1件と2件）に対してレビュー
      expect(mockReviewExecuteAgentGenerateLegacy).toHaveBeenCalledTimes(2);

      if (result.status === "success") {
        const workflowResult = result.result as {
          status: string;
          reviewResults?: Array<{
            checkListItemContent: string;
            evaluation: string | null;
            comment: string | null;
            errorMessage: string | null;
          }>;
        };
        expect(workflowResult.reviewResults).toHaveLength(3);
      }
    });
  });

  describe("複数ファイルのテスト", () => {
    it("複数ファイル（テキスト + 画像混合）が処理できること", async () => {
      // Arrange: fileProcessingStepが混合ファイルを処理した結果をモック
      mockFileProcessingStep.mockResolvedValue({
        status: "success",
        extractedFiles: [
          {
            id: "file-1",
            name: "text-document.txt",
            type: "text/plain",
            processMode: "text",
            textContent: "テキストファイルの内容",
          },
          {
            id: "file-2",
            name: "image-document.pdf",
            type: "application/pdf",
            processMode: "image",
            imageData: ["base64encodedimage"],
          },
        ],
      });

      const mixedFiles: RawUploadFileMeta[] = [
        {
          id: "file-1",
          name: "text-document.txt",
          type: "text/plain",
          size: 1000,
          processMode: "text",
        },
        {
          id: "file-2",
          name: "image-document.pdf",
          type: "application/pdf",
          size: 5000,
          processMode: "image",
          convertedImageCount: 1,
        },
      ];

      // AIはショートID（1始まりの連番）を返す
      mockReviewExecuteAgentGenerateLegacy.mockResolvedValue({
        finishReason: "stop",
        object: [
          {
            checklistId: 1, // check-1のショートID
            reviewSections: [],
            comment: "混合ファイルからレビュー",
            evaluation: "A",
          },
        ],
      });

      // Act
      const run = await reviewExecutionWorkflow.createRunAsync();
      const result = await run.start({
        inputData: {
          files: mixedFiles,
          checkListItems: [testCheckListItems[0]],
        },
        runtimeContext: createTestRuntimeContext(),
      });

      // Assert
      const checkResult = checkWorkflowResult(result);
      expect(checkResult.status).toBe("success");

      // メッセージにテキストと画像の両方が含まれる
      const callArgs = mockReviewExecuteAgentGenerateLegacy.mock.calls[0];
      const message = callArgs[0];

      // テキストコンテンツが含まれる
      expect(message.content).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "text",
          }),
        ])
      );

      // 画像コンテンツが含まれる
      expect(message.content).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "image",
          }),
        ])
      );
    });
  });

  describe("finishReasonのテスト", () => {
    it("finishReasonがlengthの場合にworkflowが失敗すること", async () => {
      // Arrange: finishReasonがlength（トークン上限到達）
      mockReviewExecuteAgentGenerateLegacy.mockResolvedValue({
        finishReason: "length",
        object: [],
      });

      // Act
      const run = await reviewExecutionWorkflow.createRunAsync();
      const result = await run.start({
        inputData: {
          files: testFiles,
          checkListItems: [testCheckListItems[0]],
        },
        runtimeContext: createTestRuntimeContext(),
      });

      // Assert
      const checkResult = checkWorkflowResult(result);
      expect(checkResult.status).toBe("failed");
      // workflowのエラーハンドリングによりメッセージが変換される可能性がある
      expect(checkResult.errorMessage).toBeDefined();
    });

    it("finishReasonがcontent-filterの場合にworkflowが失敗すること", async () => {
      // Arrange: finishReasonがcontent-filter
      mockReviewExecuteAgentGenerateLegacy.mockResolvedValue({
        finishReason: "content-filter",
        object: [],
      });

      // Act
      const run = await reviewExecutionWorkflow.createRunAsync();
      const result = await run.start({
        inputData: {
          files: testFiles,
          checkListItems: [testCheckListItems[0]],
        },
        runtimeContext: createTestRuntimeContext(),
      });

      // Assert
      const checkResult = checkWorkflowResult(result);
      expect(checkResult.status).toBe("failed");
      // workflowのエラーハンドリングによりメッセージが変換される可能性がある
      expect(checkResult.errorMessage).toBeDefined();
    });
  });

  describe("DB保存コールバックのテスト", () => {
    it("DB保存コールバックが設定されている場合、レビュー結果ごとに呼び出されること", async () => {
      // Arrange: AIはショートID（1始まりの連番）を返す
      const mockOnReviewResultSaved = vi.fn().mockResolvedValue(undefined);
      mockReviewExecuteAgentGenerateLegacy.mockResolvedValue({
        finishReason: "stop",
        object: [
          {
            checklistId: 1, // check-1のショートID
            reviewSections: [],
            comment: "コメント1",
            evaluation: "A",
          },
          {
            checklistId: 2, // check-2のショートID
            reviewSections: [],
            comment: "コメント2",
            evaluation: "B",
          },
        ],
      });

      // Act
      const runtimeContext = createTestRuntimeContext();
      runtimeContext.set("reviewTargetId", "target-123");
      runtimeContext.set("onReviewResultSaved", mockOnReviewResultSaved);

      const run = await reviewExecutionWorkflow.createRunAsync();
      const result = await run.start({
        inputData: {
          files: testFiles,
          checkListItems: [testCheckListItems[0], testCheckListItems[1]],
          reviewSettings: {
            evaluationCriteria: testEvaluationCriteria,
          },
        },
        runtimeContext,
      });

      // Assert
      const checkResult = checkWorkflowResult(result);
      expect(checkResult.status).toBe("success");
      expect(mockOnReviewResultSaved).toHaveBeenCalledTimes(1);
      expect(mockOnReviewResultSaved).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            checkListItemContent: "セキュリティ要件を満たしているか",
            evaluation: "A",
          }),
          expect.objectContaining({
            checkListItemContent: "エラーハンドリングが適切か",
            evaluation: "B",
          }),
        ]),
        "target-123"
      );
    });

    it("DB保存コールバックが未設定でもworkflowが成功すること", async () => {
      // Arrange: AIはショートID（1始まりの連番）を返す
      mockReviewExecuteAgentGenerateLegacy.mockResolvedValue({
        finishReason: "stop",
        object: [
          {
            checklistId: 1, // check-1のショートID
            reviewSections: [],
            comment: "コメント",
            evaluation: "A",
          },
        ],
      });

      // Act（コールバック未設定）
      const run = await reviewExecutionWorkflow.createRunAsync();
      const result = await run.start({
        inputData: {
          files: testFiles,
          checkListItems: [testCheckListItems[0]],
        },
        runtimeContext: createTestRuntimeContext(),
      });

      // Assert
      const checkResult = checkWorkflowResult(result);
      expect(checkResult.status).toBe("success");
    });
  });

  describe("大量レビュー（reviewType: large）のテスト", () => {
    // 大量レビューのテストは、largeDocumentReviewWorkflowのモックが複雑なため、
    // ここではワークフローの構造（チェックリスト分割が共通で適用されること）のみを検証する

    it("大量レビュー時にチェックリスト分類が呼ばれること（concurrentReviewItems=2）", async () => {
      // Arrange: AIカテゴリ分類で2チャンクに分割
      mockChecklistCategoryAgentGenerateLegacy.mockResolvedValue({
        finishReason: "stop",
        object: {
          categories: [
            { name: "セキュリティ", checklistIds: [1] }, // check-1のショートID
            { name: "その他", checklistIds: [2, 3] }, // check-2, 3のショートID
          ],
        },
      });

      // Act: 大量レビューを実行
      // 注: largeDocumentReviewWorkflowの内部処理はモックされていないためエラーになるが、
      // チェックリスト分類が呼ばれるかどうかを確認するのが目的
      const run = await reviewExecutionWorkflow.createRunAsync();
      await run.start({
        inputData: {
          files: [
            {
              id: "file-1",
              name: "test-document.txt",
              type: "text/plain",
              size: 1000,
              processMode: "text" as const,
            },
          ],
          checkListItems: [
            { id: "check-1", content: "セキュリティ要件を満たしているか" },
            { id: "check-2", content: "エラーハンドリングが適切か" },
            { id: "check-3", content: "パフォーマンス要件を満たしているか" },
          ],
          reviewSettings: {
            concurrentReviewItems: 2,
          },
          reviewType: "large" as const,
        },
        runtimeContext: createTestRuntimeContext(),
      });

      // Assert: AIカテゴリ分類が呼ばれていることを確認
      // これにより、大量レビューでもチェックリスト分割が適用されていることが証明される
      expect(mockChecklistCategoryAgentGenerateLegacy).toHaveBeenCalledTimes(1);
    });

    it("大量レビューでconcurrentReviewItems未指定の場合、チェックリスト分類が呼ばれないこと", async () => {
      // Act: concurrentReviewItems未指定で大量レビューを実行
      const run = await reviewExecutionWorkflow.createRunAsync();
      await run.start({
        inputData: {
          files: [
            {
              id: "file-1",
              name: "test-document.txt",
              type: "text/plain",
              size: 1000,
              processMode: "text" as const,
            },
          ],
          checkListItems: [
            { id: "check-1", content: "セキュリティ要件を満たしているか" },
            { id: "check-2", content: "エラーハンドリングが適切か" },
            { id: "check-3", content: "パフォーマンス要件を満たしているか" },
          ],
          reviewType: "large" as const,
          // concurrentReviewItems未指定 → 全項目一括でレビュー
        },
        runtimeContext: createTestRuntimeContext(),
      });

      // Assert: チェックリスト分類は呼ばれない（全項目一括のため分割不要）
      expect(mockChecklistCategoryAgentGenerateLegacy).not.toHaveBeenCalled();
    });
  });
});
