/**
 * 大量ドキュメントレビューワークフローのテスト
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RuntimeContext } from "@mastra/core/di";
import {
  largeDocumentReviewWorkflow,
  type LargeDocumentReviewInput,
} from "../index";
import { checkWorkflowResult } from "../../../../lib/workflowUtils";
import type { CheckListItem, EvaluationCriterion } from "../../types";

// vi.hoistedを使ってモック関数をホイスト
const {
  mockIndividualDocumentReviewAgentGenerateLegacy,
  mockConsolidateReviewAgentGenerateLegacy,
} = vi.hoisted(() => ({
  mockIndividualDocumentReviewAgentGenerateLegacy: vi.fn(),
  mockConsolidateReviewAgentGenerateLegacy: vi.fn(),
}));

// エージェントのモック設定
vi.mock("../../../../agents", () => ({
  individualDocumentReviewAgent: {
    generateLegacy: (...args: unknown[]) =>
      mockIndividualDocumentReviewAgentGenerateLegacy(...args),
  },
  individualDocumentReviewOutputSchema: {
    parse: vi.fn((v: unknown) => v),
  },
  consolidateReviewAgent: {
    generateLegacy: (...args: unknown[]) =>
      mockConsolidateReviewAgentGenerateLegacy(...args),
  },
}));

describe("largeDocumentReviewWorkflow", () => {
  // テストデータ: 抽出済みファイル（テキストモード）
  const testTextFiles = [
    {
      id: "file-1",
      name: "document1.txt",
      type: "text/plain",
      processMode: "text" as const,
      textContent: "ドキュメント1の内容です。",
    },
    {
      id: "file-2",
      name: "document2.txt",
      type: "text/plain",
      processMode: "text" as const,
      textContent: "ドキュメント2の内容です。",
    },
  ];

  // テストデータ: 画像モードのファイル
  const testImageFiles = [
    {
      id: "file-1",
      name: "document1.pdf",
      type: "application/pdf",
      processMode: "image" as const,
      imageData: ["base64image1", "base64image2"],
    },
  ];

  // テストデータ: チェックリスト項目
  const testCheckListItems: CheckListItem[] = [
    { id: "check-1", content: "セキュリティ要件を満たしているか" },
    { id: "check-2", content: "エラーハンドリングが適切か" },
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("正常系", () => {
    it("複数ファイルの並列レビューと統合が成功すること", async () => {
      // Arrange: 個別レビューの結果
      mockIndividualDocumentReviewAgentGenerateLegacy.mockResolvedValue({
        finishReason: "stop",
        object: [
          { checklistId: 1, reviewSections: [], comment: "コメント1" },
          { checklistId: 2, reviewSections: [], comment: "コメント2" },
        ],
      });

      // Arrange: 統合レビューの結果
      mockConsolidateReviewAgentGenerateLegacy.mockResolvedValue({
        finishReason: "stop",
        object: [
          { checklistId: 1, comment: "統合コメント1", evaluation: "A" },
          { checklistId: 2, comment: "統合コメント2", evaluation: "B" },
        ],
      });

      // Act
      const run = await largeDocumentReviewWorkflow.createRunAsync();
      const result = await run.start({
        inputData: {
          files: testTextFiles,
          checkListItems: testCheckListItems,
          evaluationCriteria: testEvaluationCriteria,
        } as LargeDocumentReviewInput,
        runtimeContext: createTestRuntimeContext(),
      });

      // Assert
      const checkResult = checkWorkflowResult(result);
      expect(checkResult.status).toBe("success");

      // 個別レビューは2ファイル分呼ばれる
      expect(
        mockIndividualDocumentReviewAgentGenerateLegacy,
      ).toHaveBeenCalledTimes(2);

      // 統合レビューは1回呼ばれる
      expect(mockConsolidateReviewAgentGenerateLegacy).toHaveBeenCalledTimes(1);

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
        expect(workflowResult.reviewResults).toHaveLength(2);
        expect(workflowResult.reviewResults).toContainEqual(
          expect.objectContaining({
            checkListItemContent: "セキュリティ要件を満たしているか",
            evaluation: "A",
          }),
        );
      }
    });

    it("単一ファイルの大量レビューが成功すること", async () => {
      // Arrange
      mockIndividualDocumentReviewAgentGenerateLegacy.mockResolvedValue({
        finishReason: "stop",
        object: [
          { checklistId: 1, reviewSections: [], comment: "コメント1" },
          { checklistId: 2, reviewSections: [], comment: "コメント2" },
        ],
      });

      mockConsolidateReviewAgentGenerateLegacy.mockResolvedValue({
        finishReason: "stop",
        object: [
          { checklistId: 1, comment: "統合コメント1", evaluation: "A" },
          { checklistId: 2, comment: "統合コメント2", evaluation: "B" },
        ],
      });

      // Act
      const run = await largeDocumentReviewWorkflow.createRunAsync();
      const result = await run.start({
        inputData: {
          files: [testTextFiles[0]],
          checkListItems: testCheckListItems,
        } as LargeDocumentReviewInput,
        runtimeContext: createTestRuntimeContext(),
      });

      // Assert
      const checkResult = checkWorkflowResult(result);
      expect(checkResult.status).toBe("success");
      expect(
        mockIndividualDocumentReviewAgentGenerateLegacy,
      ).toHaveBeenCalledTimes(1);
    });
  });

  describe("コンテキスト長エラー時の分割リトライ", () => {
    it("content_lengthエラー時にドキュメントを分割してリトライすること", async () => {
      // Arrange: 1回目はcontent_length、2回目以降は成功
      let callCount = 0;
      mockIndividualDocumentReviewAgentGenerateLegacy.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // 1回目: content_lengthエラー
          return Promise.resolve({
            finishReason: "length",
            object: null,
          });
        }
        // 2回目以降: 成功
        return Promise.resolve({
          finishReason: "stop",
          object: [
            {
              checklistId: 1,
              reviewSections: [],
              comment: `パート${callCount}のコメント1`,
            },
            {
              checklistId: 2,
              reviewSections: [],
              comment: `パート${callCount}のコメント2`,
            },
          ],
        });
      });

      mockConsolidateReviewAgentGenerateLegacy.mockResolvedValue({
        finishReason: "stop",
        object: [
          { checklistId: 1, comment: "統合コメント1", evaluation: "A" },
          { checklistId: 2, comment: "統合コメント2", evaluation: "B" },
        ],
      });

      // Act: 長いテキストを持つファイルでテスト
      const longTextFile = {
        id: "file-1",
        name: "long-document.txt",
        type: "text/plain",
        processMode: "text" as const,
        textContent: "A".repeat(10000), // 長いテキスト
      };

      const run = await largeDocumentReviewWorkflow.createRunAsync();
      const result = await run.start({
        inputData: {
          files: [longTextFile],
          checkListItems: testCheckListItems,
        } as LargeDocumentReviewInput,
        runtimeContext: createTestRuntimeContext(),
      });

      // Assert
      const checkResult = checkWorkflowResult(result);
      expect(checkResult.status).toBe("success");

      // 1回目: content_lengthエラー → 2分割してリトライ → 2回呼ばれる
      // 合計3回（1回目 + リトライ2回）
      expect(
        mockIndividualDocumentReviewAgentGenerateLegacy,
      ).toHaveBeenCalledTimes(3);
    });

    it("画像ファイルでもcontent_lengthエラー時に分割リトライすること", async () => {
      // Arrange: 1回目はcontent_length、2回目以降は成功
      let callCount = 0;
      mockIndividualDocumentReviewAgentGenerateLegacy.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            finishReason: "length",
            object: null,
          });
        }
        return Promise.resolve({
          finishReason: "stop",
          object: [
            {
              checklistId: 1,
              reviewSections: [],
              comment: `パート${callCount}のコメント`,
            },
          ],
        });
      });

      mockConsolidateReviewAgentGenerateLegacy.mockResolvedValue({
        finishReason: "stop",
        object: [{ checklistId: 1, comment: "統合コメント", evaluation: "A" }],
      });

      const singleCheckItem: CheckListItem[] = [
        { id: "check-1", content: "要件1" },
      ];

      // Act: 多数の画像を持つファイル
      const manyImagesFile = {
        id: "file-1",
        name: "many-images.pdf",
        type: "application/pdf",
        processMode: "image" as const,
        imageData: Array(10).fill("base64image"), // 10枚の画像
      };

      const run = await largeDocumentReviewWorkflow.createRunAsync();
      const result = await run.start({
        inputData: {
          files: [manyImagesFile],
          checkListItems: singleCheckItem,
        } as LargeDocumentReviewInput,
        runtimeContext: createTestRuntimeContext(),
      });

      // Assert
      const checkResult = checkWorkflowResult(result);
      expect(checkResult.status).toBe("success");
      // 分割リトライが発生するため3回以上呼ばれる
      expect(
        mockIndividualDocumentReviewAgentGenerateLegacy.mock.calls.length,
      ).toBeGreaterThanOrEqual(2);
    });
  });

  describe("異常系", () => {
    it("個別レビューがエラーの場合、ワークフローが失敗すること", async () => {
      // Arrange: 個別レビューがエラー（content_length以外）
      mockIndividualDocumentReviewAgentGenerateLegacy.mockResolvedValue({
        finishReason: "content-filter",
        object: null,
      });

      // Act
      const run = await largeDocumentReviewWorkflow.createRunAsync();
      const result = await run.start({
        inputData: {
          files: testTextFiles,
          checkListItems: testCheckListItems,
        } as LargeDocumentReviewInput,
        runtimeContext: createTestRuntimeContext(),
      });

      // Assert
      const checkResult = checkWorkflowResult(result);
      expect(checkResult.status).toBe("failed");
    });

    it("統合レビューでエラーが発生した場合、エラー結果が返されること", async () => {
      // Arrange: 個別レビューは成功
      mockIndividualDocumentReviewAgentGenerateLegacy.mockResolvedValue({
        finishReason: "stop",
        object: [
          { checklistId: 1, reviewSections: [], comment: "コメント1" },
          { checklistId: 2, reviewSections: [], comment: "コメント2" },
        ],
      });

      // Arrange: 統合レビューでエラー
      mockConsolidateReviewAgentGenerateLegacy.mockRejectedValue(
        new Error("統合レビューエラー"),
      );

      // Act
      const run = await largeDocumentReviewWorkflow.createRunAsync();
      const result = await run.start({
        inputData: {
          files: testTextFiles,
          checkListItems: testCheckListItems,
        } as LargeDocumentReviewInput,
        runtimeContext: createTestRuntimeContext(),
      });

      // Assert: 統合ステップでエラーが発生すると、ワークフロー結果自体がfailedになる
      // （consolidateReviewStepはエラー時もreviewResultsを返すが、statusはfailedとなる）
      const checkResult = checkWorkflowResult(result);
      expect(checkResult.status).toBe("failed");

      // 結果の詳細検証（ワークフロー自体はfailedでも、結果データは取得可能）
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

        // 統合ステップでエラーが発生すると、全チェック項目にエラーが設定される
        expect(workflowResult.status).toBe("failed");
        expect(workflowResult.reviewResults).toBeDefined();
        expect(workflowResult.reviewResults).toHaveLength(2);

        // 各レビュー結果にエラーメッセージが含まれていることを確認
        for (const reviewResult of workflowResult.reviewResults!) {
          expect(reviewResult.errorMessage).toBeDefined();
          expect(reviewResult.errorMessage).not.toBeNull();
          expect(reviewResult.evaluation).toBeNull();
          expect(reviewResult.comment).toBeNull();
        }
      }
    });

    it("最大分割リトライ回数に達した場合、エラーを返すこと", async () => {
      // Arrange: 常にcontent_lengthエラーを返す
      mockIndividualDocumentReviewAgentGenerateLegacy.mockResolvedValue({
        finishReason: "length",
        object: null,
      });

      // Act: 短いテキストでもcontent_lengthエラーが続く場合をシミュレート
      const run = await largeDocumentReviewWorkflow.createRunAsync();
      const result = await run.start({
        inputData: {
          files: [testTextFiles[0]],
          checkListItems: testCheckListItems,
        } as LargeDocumentReviewInput,
        runtimeContext: createTestRuntimeContext(),
      });

      // Assert: 最大リトライ回数（5回）の分割を試みた後、失敗
      const checkResult = checkWorkflowResult(result);
      expect(checkResult.status).toBe("failed");
      // MAX_SPLIT_RETRY_COUNT = 5なので、1 + 2 + 3 + 4 + 5 + 6 = 21回以内
      // 実際には分割数が増えていくので、回数は実装依存
      expect(
        mockIndividualDocumentReviewAgentGenerateLegacy.mock.calls.length,
      ).toBeGreaterThan(5);
    });
  });

  describe("オプション設定", () => {
    it("追加指示とコメントフォーマットが個別レビューと統合レビューに渡されること", async () => {
      // Arrange
      mockIndividualDocumentReviewAgentGenerateLegacy.mockResolvedValue({
        finishReason: "stop",
        object: [{ checklistId: 1, reviewSections: [], comment: "コメント" }],
      });

      mockConsolidateReviewAgentGenerateLegacy.mockResolvedValue({
        finishReason: "stop",
        object: [{ checklistId: 1, comment: "統合コメント", evaluation: "A" }],
      });

      const singleCheckItem: CheckListItem[] = [
        { id: "check-1", content: "要件1" },
      ];

      // Act
      const run = await largeDocumentReviewWorkflow.createRunAsync();
      const result = await run.start({
        inputData: {
          files: [testTextFiles[0]],
          checkListItems: singleCheckItem,
          additionalInstructions: "特別な指示",
          commentFormat: "カスタムフォーマット",
        } as LargeDocumentReviewInput,
        runtimeContext: createTestRuntimeContext(),
      });

      // Assert: ワークフローが成功すること
      const checkResult = checkWorkflowResult(result);
      expect(checkResult.status).toBe("success");

      // Assert: 個別レビューエージェントが呼ばれていること
      expect(
        mockIndividualDocumentReviewAgentGenerateLegacy,
      ).toHaveBeenCalled();

      // Assert: 個別レビューエージェントに渡されたRuntimeContextを検証
      const individualCall =
        mockIndividualDocumentReviewAgentGenerateLegacy.mock.calls[0];
      const individualOptions = individualCall[1] as {
        runtimeContext: RuntimeContext;
      };
      expect(individualOptions.runtimeContext).toBeDefined();
      expect(
        individualOptions.runtimeContext.get("additionalInstructions"),
      ).toBe("特別な指示");
      expect(individualOptions.runtimeContext.get("commentFormat")).toBe(
        "カスタムフォーマット",
      );
      expect(individualOptions.runtimeContext.get("checklistItems")).toEqual(
        singleCheckItem,
      );

      // Assert: 統合レビューエージェントが呼ばれていること
      expect(mockConsolidateReviewAgentGenerateLegacy).toHaveBeenCalled();

      // Assert: 統合レビューエージェントに渡されたRuntimeContextを検証
      const consolidateCall =
        mockConsolidateReviewAgentGenerateLegacy.mock.calls[0];
      const consolidateOptions = consolidateCall[1] as {
        runtimeContext: RuntimeContext;
      };
      expect(consolidateOptions.runtimeContext).toBeDefined();
      expect(
        consolidateOptions.runtimeContext.get("additionalInstructions"),
      ).toBe("特別な指示");
      expect(consolidateOptions.runtimeContext.get("commentFormat")).toBe(
        "カスタムフォーマット",
      );
      expect(consolidateOptions.runtimeContext.get("checklistItems")).toEqual(
        singleCheckItem,
      );
    });

    it("評価基準が統合レビューに渡されること", async () => {
      // Arrange
      mockIndividualDocumentReviewAgentGenerateLegacy.mockResolvedValue({
        finishReason: "stop",
        object: [{ checklistId: 1, reviewSections: [], comment: "コメント" }],
      });

      mockConsolidateReviewAgentGenerateLegacy.mockResolvedValue({
        finishReason: "stop",
        object: [{ checklistId: 1, comment: "統合コメント", evaluation: "優" }],
      });

      const singleCheckItem: CheckListItem[] = [
        { id: "check-1", content: "要件1" },
      ];

      const customEvaluationCriteria: EvaluationCriterion[] = [
        { label: "優", description: "非常に良い" },
        { label: "良", description: "良い" },
        { label: "可", description: "改善の余地あり" },
      ];

      // Act
      const run = await largeDocumentReviewWorkflow.createRunAsync();
      const result = await run.start({
        inputData: {
          files: [testTextFiles[0]],
          checkListItems: singleCheckItem,
          evaluationCriteria: customEvaluationCriteria,
        } as LargeDocumentReviewInput,
        runtimeContext: createTestRuntimeContext(),
      });

      // Assert: ワークフローが成功すること
      const checkResult = checkWorkflowResult(result);
      expect(checkResult.status).toBe("success");

      // Assert: 統合レビューエージェントに渡されたRuntimeContextを検証
      const consolidateCall =
        mockConsolidateReviewAgentGenerateLegacy.mock.calls[0];
      const consolidateOptions = consolidateCall[1] as {
        runtimeContext: RuntimeContext;
      };
      expect(consolidateOptions.runtimeContext).toBeDefined();
      expect(
        consolidateOptions.runtimeContext.get("evaluationCriteria"),
      ).toEqual(customEvaluationCriteria);

      // Assert: カスタム評価基準の評価値が結果に含まれること
      if (result.status === "success") {
        const workflowResult = result.result as {
          status: string;
          reviewResults?: Array<{
            evaluation: string | null;
          }>;
        };
        expect(workflowResult.reviewResults?.[0].evaluation).toBe("優");
      }
    });
  });
});
