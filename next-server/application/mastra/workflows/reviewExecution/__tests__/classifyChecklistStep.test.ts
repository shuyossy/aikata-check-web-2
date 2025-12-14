/**
 * チェックリスト分類ステップのテスト
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RuntimeContext } from "@mastra/core/di";
import { classifyChecklistStep } from "../steps/classifyChecklistStep";
import type { CheckListItem } from "../types";

// vi.hoistedを使ってモック関数をホイスト
const { mockChecklistCategoryAgentGenerateLegacy } = vi.hoisted(() => ({
  mockChecklistCategoryAgentGenerateLegacy: vi.fn(),
}));

// エージェントのモック設定
vi.mock("../../../agents", () => ({
  checklistCategoryAgent: {
    generateLegacy: (...args: unknown[]) =>
      mockChecklistCategoryAgentGenerateLegacy(...args),
  },
  checklistCategoryOutputSchema: {
    parse: vi.fn((v: unknown) => v),
  },
}));

describe("classifyChecklistStep", () => {
  // テストデータ: チェックリスト項目
  const testCheckListItems: CheckListItem[] = [
    { id: "check-1", content: "セキュリティ要件を満たしているか" },
    { id: "check-2", content: "エラーハンドリングが適切か" },
    { id: "check-3", content: "パフォーマンス要件を満たしているか" },
    { id: "check-4", content: "ログ出力が適切か" },
    { id: "check-5", content: "テストカバレッジが十分か" },
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

  // テスト用のステップ実行パラメータを作成するヘルパー
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createStepParams = (inputData: any) =>
    ({
      inputData,
      runtimeContext: createTestRuntimeContext(),
      getStepResult: vi.fn(),
      getInitData: vi.fn(),
      suspend: vi.fn(),
      resumeData: undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

  describe("正常系", () => {
    it("concurrentReviewItems未指定の場合、全項目が1チャンクになること", async () => {
      // Act
      const result = await classifyChecklistStep.execute(
        createStepParams({
          checkListItems: testCheckListItems,
          // concurrentReviewItems未指定
        })
      );

      // Assert
      expect(result.status).toBe("success");
      expect(result.chunks).toHaveLength(1);
      expect(result.chunks?.[0]).toHaveLength(5);
      // AI分類は呼ばれない
      expect(mockChecklistCategoryAgentGenerateLegacy).not.toHaveBeenCalled();
    });

    it("concurrentReviewItemsが項目数以上の場合、全項目が1チャンクになること", async () => {
      // Act
      const result = await classifyChecklistStep.execute(
        createStepParams({
          checkListItems: testCheckListItems,
          concurrentReviewItems: 10, // 項目数（5）より大きい
        })
      );

      // Assert
      expect(result.status).toBe("success");
      expect(result.chunks).toHaveLength(1);
      expect(result.chunks?.[0]).toHaveLength(5);
      // AI分類は呼ばれない
      expect(mockChecklistCategoryAgentGenerateLegacy).not.toHaveBeenCalled();
    });

    it("concurrentReviewItems=1の場合、各項目が個別のチャンクになること", async () => {
      // Act
      const result = await classifyChecklistStep.execute(
        createStepParams({
          checkListItems: testCheckListItems,
          concurrentReviewItems: 1,
        })
      );

      // Assert
      expect(result.status).toBe("success");
      expect(result.chunks).toHaveLength(5);
      result.chunks?.forEach((chunk, index) => {
        expect(chunk).toHaveLength(1);
        expect(chunk[0].id).toBe(testCheckListItems[index].id);
      });
      // AI分類は呼ばれない（1件ずつなのでAI分類不要）
      expect(mockChecklistCategoryAgentGenerateLegacy).not.toHaveBeenCalled();
    });

    it("concurrentReviewItems>=2の場合、AIカテゴリ分類が実行されること", async () => {
      // Arrange
      mockChecklistCategoryAgentGenerateLegacy.mockResolvedValue({
        object: {
          categories: [
            {
              name: "セキュリティ",
              checklistIds: ["check-1"],
            },
            {
              name: "エラー処理",
              checklistIds: ["check-2"],
            },
            {
              name: "パフォーマンス",
              checklistIds: ["check-3", "check-4", "check-5"],
            },
          ],
        },
      });

      // Act
      const result = await classifyChecklistStep.execute(
        createStepParams({
          checkListItems: testCheckListItems,
          concurrentReviewItems: 2,
        })
      );

      // Assert
      expect(result.status).toBe("success");
      expect(mockChecklistCategoryAgentGenerateLegacy).toHaveBeenCalledTimes(1);

      // チャンクが作成されている
      expect(result.chunks).toBeDefined();
      // 各チャンクは最大2件
      result.chunks?.forEach((chunk) => {
        expect(chunk.length).toBeLessThanOrEqual(2);
      });

      // 全項目が含まれている
      const allIds = result.chunks?.flat().map((item) => item.id) ?? [];
      expect(allIds).toHaveLength(5);
      expect(new Set(allIds)).toEqual(
        new Set(testCheckListItems.map((item) => item.id))
      );
    });

    it("AIカテゴリ分類で未分類項目がある場合、その他カテゴリに追加されること", async () => {
      // Arrange: check-5が未分類
      mockChecklistCategoryAgentGenerateLegacy.mockResolvedValue({
        object: {
          categories: [
            {
              name: "セキュリティ",
              checklistIds: ["check-1", "check-2"],
            },
            {
              name: "パフォーマンス",
              checklistIds: ["check-3", "check-4"],
            },
            // check-5が含まれていない
          ],
        },
      });

      // Act
      const result = await classifyChecklistStep.execute(
        createStepParams({
          checkListItems: testCheckListItems,
          concurrentReviewItems: 2,
        })
      );

      // Assert
      expect(result.status).toBe("success");

      // 全項目が含まれている（check-5もその他カテゴリに追加される）
      const allIds = result.chunks?.flat().map((item) => item.id) ?? [];
      expect(allIds).toContain("check-5");
      expect(new Set(allIds)).toEqual(
        new Set(testCheckListItems.map((item) => item.id))
      );
    });

    it("空のチェックリストの場合、空のchunksが返されること", async () => {
      // Act
      const result = await classifyChecklistStep.execute(
        createStepParams({
          checkListItems: [],
          concurrentReviewItems: 2,
        })
      );

      // Assert
      expect(result.status).toBe("success");
      expect(result.chunks).toHaveLength(0);
      expect(mockChecklistCategoryAgentGenerateLegacy).not.toHaveBeenCalled();
    });
  });

  describe("異常系", () => {
    it("AIカテゴリ分類がエラーの場合、単純分割にフォールバックすること", async () => {
      // Arrange
      mockChecklistCategoryAgentGenerateLegacy.mockRejectedValue(
        new Error("AI APIエラー")
      );

      // Act
      const result = await classifyChecklistStep.execute(
        createStepParams({
          checkListItems: testCheckListItems,
          concurrentReviewItems: 2,
        })
      );

      // Assert: エラーではなくフォールバックで成功
      expect(result.status).toBe("success");
      expect(result.chunks).toBeDefined();

      // 均等分割される（5項目を2件ずつ → 3チャンク: [2,2,1]または[2,1,2]など）
      const allIds = result.chunks?.flat().map((item) => item.id) ?? [];
      expect(allIds).toHaveLength(5);
    });

    it("AIが空のカテゴリを返した場合、単純分割にフォールバックすること", async () => {
      // Arrange
      mockChecklistCategoryAgentGenerateLegacy.mockResolvedValue({
        object: {
          categories: [],
        },
      });

      // Act
      const result = await classifyChecklistStep.execute(
        createStepParams({
          checkListItems: testCheckListItems,
          concurrentReviewItems: 2,
        })
      );

      // Assert: フォールバックで成功
      expect(result.status).toBe("success");
      expect(result.chunks).toBeDefined();

      const allIds = result.chunks?.flat().map((item) => item.id) ?? [];
      expect(allIds).toHaveLength(5);
    });
  });

  describe("均等分割のテスト", () => {
    it("5項目を2件ずつ分割すると3チャンク（2,2,1）になること", async () => {
      // エラーが発生するようにモックを設定してフォールバックをテスト
      mockChecklistCategoryAgentGenerateLegacy.mockRejectedValue(
        new Error("AI error")
      );

      // Act
      const result = await classifyChecklistStep.execute(
        createStepParams({
          checkListItems: testCheckListItems,
          concurrentReviewItems: 2,
        })
      );

      // Assert: フォールバックによる均等分割
      expect(result.status).toBe("success");
      expect(result.chunks).toHaveLength(3);
      // 均等に分配される（2,2,1）
      const chunkSizes = result.chunks?.map((chunk) => chunk.length) ?? [];
      expect(chunkSizes.sort()).toEqual([1, 2, 2]);
    });

    it("6項目を3件ずつ分割すると2チャンク（3,3）になること", async () => {
      // Arrange
      const sixItems: CheckListItem[] = [
        ...testCheckListItems,
        { id: "check-6", content: "追加のチェック項目" },
      ];
      mockChecklistCategoryAgentGenerateLegacy.mockRejectedValue(
        new Error("AI error")
      );

      // Act
      const result = await classifyChecklistStep.execute(
        createStepParams({
          checkListItems: sixItems,
          concurrentReviewItems: 3,
        })
      );

      // Assert
      expect(result.status).toBe("success");
      expect(result.chunks).toHaveLength(2);
      expect(result.chunks?.[0]).toHaveLength(3);
      expect(result.chunks?.[1]).toHaveLength(3);
    });
  });
});
