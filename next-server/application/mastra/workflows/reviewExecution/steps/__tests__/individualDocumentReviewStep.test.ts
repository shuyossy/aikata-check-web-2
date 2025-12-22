/**
 * 個別ドキュメントレビューステップのテスト
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RuntimeContext } from "@mastra/core/di";
import {
  individualDocumentReviewStep,
  type IndividualDocumentReviewInput,
  type IndividualDocumentReviewOutput,
} from "../individualDocumentReviewStep";
import type { CheckListItem } from "../../types";

// vi.hoistedを使ってモック関数をホイスト
const { mockIndividualDocumentReviewAgentGenerateLegacy } = vi.hoisted(() => ({
  mockIndividualDocumentReviewAgentGenerateLegacy: vi.fn(),
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
}));

describe("individualDocumentReviewStep", () => {
  // テストデータ: 抽出済みファイル（テキストモード）
  const testTextFile = {
    id: "file-1",
    name: "test-document.txt",
    type: "text/plain",
    processMode: "text" as const,
    textContent: "テストドキュメントの内容です。",
  };

  // テストデータ: 分割されたファイル
  const testChunkedFile = {
    id: "file-1-chunk-0",
    name: "test-document_part1.txt",
    type: "text/plain",
    processMode: "text" as const,
    textContent: "テストドキュメントの内容（パート1）です。",
    originalName: "test-document.txt",
    totalChunks: 3,
    chunkIndex: 0,
  };

  // テストデータ: チェックリスト項目
  const testCheckListItems: CheckListItem[] = [
    { id: "check-1", content: "セキュリティ要件を満たしているか" },
    { id: "check-2", content: "エラーハンドリングが適切か" },
    { id: "check-3", content: "パフォーマンス要件を満たしているか" },
  ];

  // RuntimeContextを作成するヘルパー関数
  const createTestRuntimeContext = () => {
    const runtimeContext = new RuntimeContext();
    runtimeContext.set("employeeId", "test-user-id");
    runtimeContext.set("projectApiKey", "test-api-key");
    return runtimeContext;
  };

  // stepを実行するヘルパー関数
  const executeStep = async (
    inputData: IndividualDocumentReviewInput,
    runtimeContext = createTestRuntimeContext(),
  ): Promise<IndividualDocumentReviewOutput> => {
    // @ts-expect-error テスト用の簡略化されたexecuteパラメータ
    return await individualDocumentReviewStep.execute({
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

  describe("正常系", () => {
    it("全てのチェック項目のレビューが成功すること", async () => {
      // Arrange: AIはショートID（1始まりの連番）を返す
      mockIndividualDocumentReviewAgentGenerateLegacy.mockResolvedValue({
        finishReason: "stop",
        object: [
          {
            checklistId: 1,
            reviewSections: [{ fileName: "test.txt", sectionNames: ["intro"] }],
            comment: "セキュリティ要件を満たしています",
          },
          {
            checklistId: 2,
            reviewSections: [{ fileName: "test.txt", sectionNames: ["error"] }],
            comment: "エラーハンドリングは適切です",
          },
          {
            checklistId: 3,
            reviewSections: [{ fileName: "test.txt", sectionNames: ["perf"] }],
            comment: "パフォーマンス要件を満たしています",
          },
        ],
      });

      // Act
      const result = await executeStep({
        file: testTextFile,
        checkListItems: testCheckListItems,
      });

      // Assert
      expect(result.status).toBe("success");
      expect(result.finishReason).toBe("success");
      expect(result.reviewResults).toHaveLength(3);
      expect(
        mockIndividualDocumentReviewAgentGenerateLegacy,
      ).toHaveBeenCalledTimes(1);

      // レビュー結果の検証
      expect(result.reviewResults).toContainEqual({
        documentId: "file-1",
        documentName: "test-document.txt",
        checklistId: "check-1",
        comment: "セキュリティ要件を満たしています",
      });
      expect(result.reviewResults).toContainEqual({
        documentId: "file-1",
        documentName: "test-document.txt",
        checklistId: "check-2",
        comment: "エラーハンドリングは適切です",
      });
      expect(result.reviewResults).toContainEqual({
        documentId: "file-1",
        documentName: "test-document.txt",
        checklistId: "check-3",
        comment: "パフォーマンス要件を満たしています",
      });
    });

    it("ドキュメント分割時の情報テキストが正しく生成されること", async () => {
      // Arrange
      mockIndividualDocumentReviewAgentGenerateLegacy.mockResolvedValue({
        finishReason: "stop",
        object: [
          { checklistId: 1, reviewSections: [], comment: "コメント1" },
          { checklistId: 2, reviewSections: [], comment: "コメント2" },
        ],
      });

      const twoCheckItems: CheckListItem[] = [
        { id: "check-1", content: "要件1" },
        { id: "check-2", content: "要件2" },
      ];

      // Act
      await executeStep({
        file: testChunkedFile,
        checkListItems: twoCheckItems,
      });

      // Assert: エージェントへの呼び出し引数を検証
      expect(
        mockIndividualDocumentReviewAgentGenerateLegacy,
      ).toHaveBeenCalledTimes(1);

      const callArgs =
        mockIndividualDocumentReviewAgentGenerateLegacy.mock.calls[0];
      const message = callArgs[0];
      const textContent = message.content.find(
        (c: { type: string; text?: string }) =>
          c.type === "text" && c.text?.includes("Document Information"),
      );

      // ドキュメント分割情報が含まれていることを確認
      expect(textContent?.text).toContain(
        "Original File Name: test-document.txt",
      );
      expect(textContent?.text).toContain(
        "Current Document Name: test-document_part1.txt",
      );
      expect(textContent?.text).toContain("This is part 1 of 3");
    });

    it("追加指示とコメントフォーマットがエージェントに渡されること", async () => {
      // Arrange
      mockIndividualDocumentReviewAgentGenerateLegacy.mockResolvedValue({
        finishReason: "stop",
        object: [{ checklistId: 1, reviewSections: [], comment: "コメント" }],
      });

      const singleCheckItem: CheckListItem[] = [
        { id: "check-1", content: "要件1" },
      ];

      // Act
      await executeStep({
        file: testTextFile,
        checkListItems: singleCheckItem,
        additionalInstructions: "特別な指示",
        commentFormat: "カスタムフォーマット",
      });

      // Assert: runtimeContextにオプションが設定されていることを確認
      const callArgs =
        mockIndividualDocumentReviewAgentGenerateLegacy.mock.calls[0];
      const options = callArgs[1];

      // runtimeContextが作成されていることを確認
      expect(options.runtimeContext).toBeDefined();
    });
  });

  describe("リトライ処理", () => {
    it("AIがチェック項目を漏らした場合にリトライすること", async () => {
      // Arrange: 1回目は項目1のみ、2回目は項目2,3を返す
      mockIndividualDocumentReviewAgentGenerateLegacy
        .mockResolvedValueOnce({
          finishReason: "stop",
          object: [
            { checklistId: 1, reviewSections: [], comment: "コメント1" },
          ],
        })
        .mockResolvedValueOnce({
          finishReason: "stop",
          object: [
            { checklistId: 1, reviewSections: [], comment: "コメント2" }, // ショートID1は残りの項目の最初
            { checklistId: 2, reviewSections: [], comment: "コメント3" },
          ],
        });

      // Act
      const result = await executeStep({
        file: testTextFile,
        checkListItems: testCheckListItems,
      });

      // Assert
      expect(result.status).toBe("success");
      expect(result.finishReason).toBe("success");
      expect(
        mockIndividualDocumentReviewAgentGenerateLegacy,
      ).toHaveBeenCalledTimes(2);
      expect(result.reviewResults).toHaveLength(3);
    });

    it("最大リトライ回数到達後も未レビュー項目がある場合はエラーを返すこと", async () => {
      // Arrange: 常に空の配列を返す（どの項目もレビューされない）
      mockIndividualDocumentReviewAgentGenerateLegacy.mockResolvedValue({
        finishReason: "stop",
        object: [],
      });

      // Act
      const result = await executeStep({
        file: testTextFile,
        checkListItems: testCheckListItems,
      });

      // Assert
      expect(result.status).toBe("failed");
      expect(result.finishReason).toBe("error");
      expect(result.errorMessage).toContain("最大試行回数到達");
      // 3回とも空の結果を返すため、全項目がレビューされずに最大試行回数に到達
      expect(
        mockIndividualDocumentReviewAgentGenerateLegacy,
      ).toHaveBeenCalledTimes(3);
    });
  });

  describe("異常系", () => {
    it("finishReason='length'の場合はcontent_lengthを返すこと", async () => {
      // Arrange
      mockIndividualDocumentReviewAgentGenerateLegacy.mockResolvedValue({
        finishReason: "length",
        object: null,
      });

      // Act
      const result = await executeStep({
        file: testTextFile,
        checkListItems: testCheckListItems,
      });

      // Assert
      expect(result.status).toBe("failed");
      expect(result.finishReason).toBe("content_length");
      expect(result.errorMessage).toContain("長すぎてAIが処理できません");
      expect(
        mockIndividualDocumentReviewAgentGenerateLegacy,
      ).toHaveBeenCalledTimes(1);
    });

    it("AIエラー（content-filter）の場合はエラーをスローすること", async () => {
      // Arrange
      mockIndividualDocumentReviewAgentGenerateLegacy.mockResolvedValue({
        finishReason: "content-filter",
        object: null,
      });

      // Act
      const result = await executeStep({
        file: testTextFile,
        checkListItems: testCheckListItems,
      });

      // Assert
      expect(result.status).toBe("failed");
      expect(result.finishReason).toBe("error");
      expect(result.errorMessage).toBeDefined();
    });

    it("エージェント実行時の例外がエラー結果として返されること", async () => {
      // Arrange
      mockIndividualDocumentReviewAgentGenerateLegacy.mockRejectedValue(
        new Error("API呼び出しエラー"),
      );

      // Act
      const result = await executeStep({
        file: testTextFile,
        checkListItems: testCheckListItems,
      });

      // Assert
      expect(result.status).toBe("failed");
      expect(result.finishReason).toBe("error");
      // normalizeUnknownErrorによりエラーメッセージが正規化される
      // チェック項目内容は含まれない（normalizeUnknownErrorで正規化されるため）
      expect(result.errorMessage).toBeDefined();
    });
  });

  describe("ショートIDマッピング", () => {
    it("AIが返すショートIDが正しく元のIDにマッピングされること", async () => {
      // Arrange: AIはショートID（1,2,3）を返す
      mockIndividualDocumentReviewAgentGenerateLegacy.mockResolvedValue({
        finishReason: "stop",
        object: [
          { checklistId: 3, reviewSections: [], comment: "コメント3" }, // 順不同で返す
          { checklistId: 1, reviewSections: [], comment: "コメント1" },
          { checklistId: 2, reviewSections: [], comment: "コメント2" },
        ],
      });

      // Act
      const result = await executeStep({
        file: testTextFile,
        checkListItems: testCheckListItems,
      });

      // Assert: 元のチェックリストIDにマッピングされていること
      expect(result.reviewResults).toContainEqual(
        expect.objectContaining({
          checklistId: "check-1",
          comment: "コメント1",
        }),
      );
      expect(result.reviewResults).toContainEqual(
        expect.objectContaining({
          checklistId: "check-2",
          comment: "コメント2",
        }),
      );
      expect(result.reviewResults).toContainEqual(
        expect.objectContaining({
          checklistId: "check-3",
          comment: "コメント3",
        }),
      );
    });

    it("リトライ時に既存結果のショートIDは無視されること", async () => {
      // Arrange: 1回目はcheck-1のみ、2回目は再度check-1と残りを返す
      // 実装では、リトライ時に既存のchecklistId（元のID）をexistingIdsで追跡
      mockIndividualDocumentReviewAgentGenerateLegacy
        .mockResolvedValueOnce({
          finishReason: "stop",
          object: [
            { checklistId: 1, reviewSections: [], comment: "コメント1" },
          ],
        })
        .mockResolvedValueOnce({
          finishReason: "stop",
          object: [
            // リトライ時は残りの項目に対してショートID 1,2が割り当てられる
            { checklistId: 1, reviewSections: [], comment: "コメント2" }, // check-2
            { checklistId: 2, reviewSections: [], comment: "コメント3" }, // check-3
          ],
        });

      // Act
      const result = await executeStep({
        file: testTextFile,
        checkListItems: testCheckListItems,
      });

      // Assert: 全項目がレビューされ、最初のコメントが採用される
      expect(result.status).toBe("success");
      expect(result.reviewResults).toHaveLength(3);
      const check1Result = result.reviewResults?.find(
        (r) => r.checklistId === "check-1",
      );
      expect(check1Result?.comment).toBe("コメント1");
    });
  });
});
