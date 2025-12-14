/**
 * レビュー結果統合ステップのテスト
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RuntimeContext } from "@mastra/core/di";
import {
  consolidateReviewStep,
  groupReviewResultsByDocument,
  type ConsolidateReviewInput,
  type ConsolidateReviewOutput,
  type DocumentWithReviewResults,
} from "../consolidateReviewStep";
import type { IndividualDocumentReviewResult } from "../individualDocumentReviewStep";
import type { CheckListItem, EvaluationCriterion } from "../../types";

// vi.hoistedを使ってモック関数をホイスト
const { mockConsolidateReviewAgentGenerateLegacy } = vi.hoisted(() => ({
  mockConsolidateReviewAgentGenerateLegacy: vi.fn(),
}));

// エージェントのモック設定
vi.mock("../../../../agents", () => ({
  consolidateReviewAgent: {
    generateLegacy: (...args: unknown[]) =>
      mockConsolidateReviewAgentGenerateLegacy(...args),
  },
}));

describe("consolidateReviewStep", () => {
  // テストデータ: 個別レビュー結果付きドキュメント
  const testDocumentsWithReviewResults: DocumentWithReviewResults[] = [
    {
      documentId: "doc-1",
      documentName: "document1.txt",
      originalName: "document1.txt",
      reviewResults: [
        { checklistId: "check-1", comment: "ドキュメント1のコメント1" },
        { checklistId: "check-2", comment: "ドキュメント1のコメント2" },
      ],
    },
    {
      documentId: "doc-2",
      documentName: "document2.txt",
      originalName: "document2.txt",
      reviewResults: [
        { checklistId: "check-1", comment: "ドキュメント2のコメント1" },
        { checklistId: "check-2", comment: "ドキュメント2のコメント2" },
      ],
    },
  ];

  // テストデータ: 分割ドキュメント
  const testChunkedDocumentsWithReviewResults: DocumentWithReviewResults[] = [
    {
      documentId: "doc-1-chunk-0",
      documentName: "document1_part1.txt",
      originalName: "document1.txt",
      reviewResults: [
        { checklistId: "check-1", comment: "パート1のコメント1" },
      ],
    },
    {
      documentId: "doc-1-chunk-1",
      documentName: "document1_part2.txt",
      originalName: "document1.txt",
      reviewResults: [
        { checklistId: "check-1", comment: "パート2のコメント1" },
      ],
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
  const createTestRuntimeContext = (
    options: {
      onReviewResultSaved?: (results: unknown[], targetId: string) => Promise<void>;
      reviewTargetId?: string;
    } = {}
  ) => {
    const runtimeContext = new RuntimeContext();
    runtimeContext.set("employeeId", "test-user-id");
    runtimeContext.set("projectApiKey", "test-api-key");
    if (options.reviewTargetId) {
      runtimeContext.set("reviewTargetId", options.reviewTargetId);
    }
    if (options.onReviewResultSaved) {
      runtimeContext.set("onReviewResultSaved", options.onReviewResultSaved);
    }
    return runtimeContext;
  };

  // stepを実行するヘルパー関数
  const executeStep = async (
    inputData: ConsolidateReviewInput,
    runtimeContext = createTestRuntimeContext()
  ): Promise<ConsolidateReviewOutput> => {
    // @ts-expect-error テスト用の簡略化されたexecuteパラメータ
    return await consolidateReviewStep.execute({
      inputData,
      runtimeContext,
      getInitData: () => undefined,
      getStepResult: () => undefined,
      suspend: async () => {
        throw new Error("suspend not implemented");
      },
      runId: "test-run-id",
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("groupReviewResultsByDocument", () => {
    it("個別レビュー結果をドキュメント別にグループ化すること", () => {
      // Arrange
      const results: IndividualDocumentReviewResult[] = [
        {
          documentId: "doc-1",
          documentName: "document1.txt",
          checklistId: "check-1",
          comment: "コメント1",
        },
        {
          documentId: "doc-1",
          documentName: "document1.txt",
          checklistId: "check-2",
          comment: "コメント2",
        },
        {
          documentId: "doc-2",
          documentName: "document2.txt",
          checklistId: "check-1",
          comment: "コメント3",
        },
      ];

      // Act
      const grouped = groupReviewResultsByDocument(results);

      // Assert
      expect(grouped).toHaveLength(2);

      const doc1 = grouped.find((d) => d.documentId === "doc-1");
      expect(doc1?.reviewResults).toHaveLength(2);

      const doc2 = grouped.find((d) => d.documentId === "doc-2");
      expect(doc2?.reviewResults).toHaveLength(1);
    });
  });

  describe("正常系", () => {
    it("複数ドキュメントの統合レビューが成功すること", async () => {
      // Arrange: AIはショートID（1始まりの連番）と評価を返す
      mockConsolidateReviewAgentGenerateLegacy.mockResolvedValue({
        finishReason: "stop",
        object: [
          {
            checklistId: 1, // check-1のショートID
            comment: "統合コメント1",
            evaluation: "A",
          },
          {
            checklistId: 2, // check-2のショートID
            comment: "統合コメント2",
            evaluation: "B",
          },
        ],
      });

      // Act
      const result = await executeStep({
        documentsWithReviewResults: testDocumentsWithReviewResults,
        checkListItems: testCheckListItems,
        evaluationCriteria: testEvaluationCriteria,
      });

      // Assert
      expect(result.status).toBe("success");
      expect(result.reviewResults).toHaveLength(2);
      expect(mockConsolidateReviewAgentGenerateLegacy).toHaveBeenCalledTimes(1);

      // レビュー結果の検証
      expect(result.reviewResults).toContainEqual({
        checkListItemContent: "セキュリティ要件を満たしているか",
        evaluation: "A",
        comment: "統合コメント1",
        errorMessage: null,
      });
      expect(result.reviewResults).toContainEqual({
        checkListItemContent: "エラーハンドリングが適切か",
        evaluation: "B",
        comment: "統合コメント2",
        errorMessage: null,
      });
    });

    it("DB保存コールバックが呼ばれること", async () => {
      // Arrange
      const mockOnReviewResultSaved = vi.fn().mockResolvedValue(undefined);
      mockConsolidateReviewAgentGenerateLegacy.mockResolvedValue({
        finishReason: "stop",
        object: [
          { checklistId: 1, comment: "統合コメント1", evaluation: "A" },
          { checklistId: 2, comment: "統合コメント2", evaluation: "B" },
        ],
      });

      // Act
      await executeStep(
        {
          documentsWithReviewResults: testDocumentsWithReviewResults,
          checkListItems: testCheckListItems,
        },
        createTestRuntimeContext({
          reviewTargetId: "target-1",
          onReviewResultSaved: mockOnReviewResultSaved,
        })
      );

      // Assert
      expect(mockOnReviewResultSaved).toHaveBeenCalledTimes(1);
      expect(mockOnReviewResultSaved).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ evaluation: "A" }),
          expect.objectContaining({ evaluation: "B" }),
        ]),
        "target-1"
      );
    });

    it("カスタム評価基準が適用されること", async () => {
      // Arrange
      const customEvaluationCriteria: EvaluationCriterion[] = [
        { label: "優", description: "素晴らしい" },
        { label: "良", description: "良い" },
        { label: "可", description: "改善の余地あり" },
      ];

      mockConsolidateReviewAgentGenerateLegacy.mockResolvedValue({
        finishReason: "stop",
        object: [
          { checklistId: 1, comment: "コメント1", evaluation: "優" },
          { checklistId: 2, comment: "コメント2", evaluation: "良" },
        ],
      });

      // Act
      const result = await executeStep({
        documentsWithReviewResults: testDocumentsWithReviewResults,
        checkListItems: testCheckListItems,
        evaluationCriteria: customEvaluationCriteria,
      });

      // Assert
      expect(result.status).toBe("success");
      expect(result.reviewResults?.[0].evaluation).toBe("優");
      expect(result.reviewResults?.[1].evaluation).toBe("良");
    });

    it("分割ドキュメントの情報がメッセージに含まれること", async () => {
      // Arrange
      mockConsolidateReviewAgentGenerateLegacy.mockResolvedValue({
        finishReason: "stop",
        object: [
          { checklistId: 1, comment: "コメント", evaluation: "A" },
        ],
      });

      const singleCheckItem: CheckListItem[] = [
        { id: "check-1", content: "要件1" },
      ];

      // Act
      await executeStep({
        documentsWithReviewResults: testChunkedDocumentsWithReviewResults,
        checkListItems: singleCheckItem,
      });

      // Assert: エージェントへの呼び出し引数を検証
      const callArgs = mockConsolidateReviewAgentGenerateLegacy.mock.calls[0];
      const message = callArgs[0];
      const textContent = message.content[0].text;

      // 分割情報が含まれていることを確認
      expect(textContent).toContain("part of document1.txt");
    });
  });

  describe("リトライ処理", () => {
    it("AIがチェック項目を漏らした場合にリトライすること", async () => {
      // Arrange: 1回目は項目1のみ、2回目は項目2を返す
      mockConsolidateReviewAgentGenerateLegacy
        .mockResolvedValueOnce({
          finishReason: "stop",
          object: [
            { checklistId: 1, comment: "コメント1", evaluation: "A" },
          ],
        })
        .mockResolvedValueOnce({
          finishReason: "stop",
          object: [
            { checklistId: 1, comment: "コメント2", evaluation: "B" }, // リトライ時のショートID 1 = check-2
          ],
        });

      // Act
      const result = await executeStep({
        documentsWithReviewResults: testDocumentsWithReviewResults,
        checkListItems: testCheckListItems,
      });

      // Assert
      expect(result.status).toBe("success");
      expect(mockConsolidateReviewAgentGenerateLegacy).toHaveBeenCalledTimes(2);
      expect(result.reviewResults).toHaveLength(2);
    });

    it("DB保存コールバックがリトライ毎に呼ばれること", async () => {
      // Arrange
      const mockOnReviewResultSaved = vi.fn().mockResolvedValue(undefined);
      mockConsolidateReviewAgentGenerateLegacy
        .mockResolvedValueOnce({
          finishReason: "stop",
          object: [
            { checklistId: 1, comment: "コメント1", evaluation: "A" },
          ],
        })
        .mockResolvedValueOnce({
          finishReason: "stop",
          object: [
            { checklistId: 1, comment: "コメント2", evaluation: "B" },
          ],
        });

      // Act
      await executeStep(
        {
          documentsWithReviewResults: testDocumentsWithReviewResults,
          checkListItems: testCheckListItems,
        },
        createTestRuntimeContext({
          reviewTargetId: "target-1",
          onReviewResultSaved: mockOnReviewResultSaved,
        })
      );

      // Assert: リトライ毎に呼ばれる（2回）
      expect(mockOnReviewResultSaved).toHaveBeenCalledTimes(2);
    });
  });

  describe("異常系", () => {
    it("最大リトライ回数到達後も未統合項目がある場合はエラー結果を含めること", async () => {
      // Arrange: 常に空の配列を返す
      mockConsolidateReviewAgentGenerateLegacy.mockResolvedValue({
        finishReason: "stop",
        object: [],
      });

      // Act
      const result = await executeStep({
        documentsWithReviewResults: testDocumentsWithReviewResults,
        checkListItems: testCheckListItems,
      });

      // Assert: 全項目がエラー結果でも、処理自体は正常終了するためstatusはsuccess
      expect(result.status).toBe("success");
      expect(result.reviewResults).toHaveLength(2);
      expect(result.reviewResults?.[0].errorMessage).toContain("最大試行回数到達");
      expect(result.reviewResults?.[1].errorMessage).toContain("最大試行回数到達");
      expect(mockConsolidateReviewAgentGenerateLegacy).toHaveBeenCalledTimes(3);
    });

    it("一部項目のみ統合された場合は成功と失敗が混在すること", async () => {
      // Arrange: 項目1のみを返し続ける
      mockConsolidateReviewAgentGenerateLegacy.mockResolvedValue({
        finishReason: "stop",
        object: [
          { checklistId: 1, comment: "コメント1", evaluation: "A" },
        ],
      });

      // Act
      const result = await executeStep({
        documentsWithReviewResults: testDocumentsWithReviewResults,
        checkListItems: testCheckListItems,
      });

      // Assert: 成功と失敗が混在するため、全体ステータスは成功
      expect(result.status).toBe("success");
      expect(result.reviewResults).toHaveLength(2);

      const successResult = result.reviewResults?.find(
        (r) => r.checkListItemContent === "セキュリティ要件を満たしているか"
      );
      expect(successResult?.evaluation).toBe("A");

      const errorResult = result.reviewResults?.find(
        (r) => r.checkListItemContent === "エラーハンドリングが適切か"
      );
      expect(errorResult?.errorMessage).toBeDefined();
    });

    it("AIエラー（content-filter）の場合はエラー結果を返すこと", async () => {
      // Arrange
      mockConsolidateReviewAgentGenerateLegacy.mockResolvedValue({
        finishReason: "content-filter",
        object: null,
      });

      // Act
      const result = await executeStep({
        documentsWithReviewResults: testDocumentsWithReviewResults,
        checkListItems: testCheckListItems,
      });

      // Assert: 例外がキャッチされ、全項目がエラー結果になる
      // content-filterエラー時はcatchブロックに入りfailedを返す
      expect(result.status).toBe("failed");
      expect(result.reviewResults).toHaveLength(2);
      expect(result.reviewResults?.[0].errorMessage).toBeDefined();
      expect(result.reviewResults?.[1].errorMessage).toBeDefined();
    });

    it("エージェント実行時の例外がエラー結果として返されること", async () => {
      // Arrange
      mockConsolidateReviewAgentGenerateLegacy.mockRejectedValue(
        new Error("API呼び出しエラー")
      );

      // Act
      const result = await executeStep({
        documentsWithReviewResults: testDocumentsWithReviewResults,
        checkListItems: testCheckListItems,
      });

      // Assert: 例外発生時はcatchブロックに入りfailedを返す
      expect(result.status).toBe("failed");
      expect(result.reviewResults).toHaveLength(2);
      // 全項目にエラーメッセージが設定される
      expect(result.reviewResults?.[0].errorMessage).toBeDefined();
      expect(result.reviewResults?.[1].errorMessage).toBeDefined();
    });

    it("エラー結果もDB保存コールバックで保存されること", async () => {
      // Arrange
      const mockOnReviewResultSaved = vi.fn().mockResolvedValue(undefined);
      mockConsolidateReviewAgentGenerateLegacy.mockRejectedValue(
        new Error("API呼び出しエラー")
      );

      // Act
      await executeStep(
        {
          documentsWithReviewResults: testDocumentsWithReviewResults,
          checkListItems: testCheckListItems,
        },
        createTestRuntimeContext({
          reviewTargetId: "target-1",
          onReviewResultSaved: mockOnReviewResultSaved,
        })
      );

      // Assert: エラー結果も保存される
      expect(mockOnReviewResultSaved).toHaveBeenCalledTimes(1);
      const savedResults = mockOnReviewResultSaved.mock.calls[0][0];
      expect(savedResults).toHaveLength(2);
      expect(savedResults[0].errorMessage).toBeDefined();
    });
  });

  describe("ショートIDマッピング", () => {
    it("AIが返すショートIDが正しく元のIDにマッピングされること", async () => {
      // Arrange: AIはショートID（1,2）を順不同で返す
      mockConsolidateReviewAgentGenerateLegacy.mockResolvedValue({
        finishReason: "stop",
        object: [
          { checklistId: 2, comment: "コメント2", evaluation: "B" },
          { checklistId: 1, comment: "コメント1", evaluation: "A" },
        ],
      });

      // Act
      const result = await executeStep({
        documentsWithReviewResults: testDocumentsWithReviewResults,
        checkListItems: testCheckListItems,
      });

      // Assert: 元のチェックリストIDにマッピングされていること
      expect(result.reviewResults).toContainEqual(
        expect.objectContaining({
          checkListItemContent: "セキュリティ要件を満たしているか",
          evaluation: "A",
        })
      );
      expect(result.reviewResults).toContainEqual(
        expect.objectContaining({
          checkListItemContent: "エラーハンドリングが適切か",
          evaluation: "B",
        })
      );
    });
  });
});
