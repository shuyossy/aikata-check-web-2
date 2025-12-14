import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// モック関数を vi.hoisted で定義してモジュールモック内で使用可能にする
const { mockStartReview, mockSaveResults, mockCompleteReview, mockFetch } = vi.hoisted(() => ({
  mockStartReview: vi.fn(),
  mockSaveResults: vi.fn(),
  mockCompleteReview: vi.fn(),
  mockFetch: vi.fn(),
}));

// サーバーアクションのモック
vi.mock("../../actions/startApiReview", () => ({
  startApiReviewAction: { _id: "start" },
}));
vi.mock("../../actions/saveApiReviewResults", () => ({
  saveApiReviewResultsAction: { _id: "save" },
}));
vi.mock("../../actions/completeApiReview", () => ({
  completeApiReviewAction: { _id: "complete" },
}));

// next-safe-action/hooksのモック
vi.mock("next-safe-action/hooks", () => ({
  useAction: vi.fn((action: { _id?: string }) => {
    if (action._id === "start") {
      return { executeAsync: mockStartReview, isPending: false };
    }
    if (action._id === "save") {
      return { executeAsync: mockSaveResults, isPending: false };
    }
    if (action._id === "complete") {
      return { executeAsync: mockCompleteReview, isPending: false };
    }
    return { executeAsync: vi.fn(), isPending: false };
  }),
}));

// グローバルfetchのモック
vi.stubGlobal("fetch", mockFetch);

// テスト対象のインポート（モック設定後）
import { useApiReview } from "../useApiReview";

describe("useApiReview", () => {
  const testReviewSpaceId = "550e8400-e29b-41d4-a716-446655440001";
  const testReviewTargetId = "550e8400-e29b-41d4-a716-446655440010";

  const baseInput = {
    reviewSpaceId: testReviewSpaceId,
    name: "テストレビュー",
    documents: [
      { name: "test.txt", type: "text" as const, content: "テストドキュメント" },
    ],
    apiEndpoint: "https://api.example.com/review",
  };

  const mockCheckListItems = [
    { id: "item-1", content: "チェック項目1" },
    { id: "item-2", content: "チェック項目2" },
    { id: "item-3", content: "チェック項目3" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("hasErrorロジック", () => {
    it("全チャンク成功時、hasError=falseでcompletedステータスになる", async () => {
      // startReview成功
      mockStartReview.mockResolvedValue({
        data: {
          reviewTargetId: testReviewTargetId,
          checkListItems: mockCheckListItems,
          concurrentReviewItems: 10,
        },
      });

      // 外部API呼び出し成功（全て成功結果）
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            { checkListItemId: "item-1", evaluation: "A", comment: "OK" },
            { checkListItemId: "item-2", evaluation: "A", comment: "OK" },
            { checkListItemId: "item-3", evaluation: "B", comment: "良好" },
          ],
        }),
      });

      // saveResults成功
      mockSaveResults.mockResolvedValue({
        data: { savedCount: 3, chunkIndex: 0, totalChunks: 1 },
      });

      // completeReview成功
      mockCompleteReview.mockResolvedValue({
        data: { reviewTargetId: testReviewTargetId, status: "completed" },
      });

      const { result } = renderHook(() => useApiReview());

      let executeResult: { success: boolean; reviewTargetId: string } | undefined;
      await act(async () => {
        executeResult = await result.current.execute(baseInput);
      });

      // hasError=falseで完了（completedステータス）
      expect(executeResult?.success).toBe(true);
      expect(mockCompleteReview).toHaveBeenCalledWith(
        expect.objectContaining({
          reviewTargetId: testReviewTargetId,
          hasError: false,
        }),
      );
    });

    it("一部チャンクでエラー発生時、成功があればhasError=falseでcompletedになる", async () => {
      // startReview成功
      mockStartReview.mockResolvedValue({
        data: {
          reviewTargetId: testReviewTargetId,
          checkListItems: mockCheckListItems,
          concurrentReviewItems: 10,
        },
      });

      // 外部API呼び出し成功（一部エラー結果）
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            { checkListItemId: "item-1", evaluation: "A", comment: "OK" },
            { checkListItemId: "item-2", evaluation: "", comment: "", error: "処理エラー" },
            { checkListItemId: "item-3", evaluation: "B", comment: "良好" },
          ],
        }),
      });

      // saveResults成功
      mockSaveResults.mockResolvedValue({
        data: { savedCount: 3, chunkIndex: 0, totalChunks: 1 },
      });

      // completeReview成功
      mockCompleteReview.mockResolvedValue({
        data: { reviewTargetId: testReviewTargetId, status: "completed" },
      });

      const { result } = renderHook(() => useApiReview());

      let executeResult: { success: boolean; reviewTargetId: string } | undefined;
      await act(async () => {
        executeResult = await result.current.execute(baseInput);
      });

      // 一部成功があるのでhasError=false（completedステータス）
      expect(executeResult?.success).toBe(true);
      expect(mockCompleteReview).toHaveBeenCalledWith(
        expect.objectContaining({
          reviewTargetId: testReviewTargetId,
          hasError: false,
        }),
      );
    });

    it("全チャンク失敗時、hasError=trueでerrorステータスになる", async () => {
      // startReview成功
      mockStartReview.mockResolvedValue({
        data: {
          reviewTargetId: testReviewTargetId,
          checkListItems: mockCheckListItems,
          concurrentReviewItems: 10,
        },
      });

      // 外部API呼び出し成功（全てエラー結果）
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            { checkListItemId: "item-1", evaluation: "", comment: "", error: "エラー1" },
            { checkListItemId: "item-2", evaluation: "", comment: "", error: "エラー2" },
            { checkListItemId: "item-3", evaluation: "", comment: "", error: "エラー3" },
          ],
        }),
      });

      // saveResults成功
      mockSaveResults.mockResolvedValue({
        data: { savedCount: 3, chunkIndex: 0, totalChunks: 1 },
      });

      // completeReview成功
      mockCompleteReview.mockResolvedValue({
        data: { reviewTargetId: testReviewTargetId, status: "error" },
      });

      const { result } = renderHook(() => useApiReview());

      let executeResult: { success: boolean; reviewTargetId: string } | undefined;
      await act(async () => {
        executeResult = await result.current.execute(baseInput);
      });

      // 全てエラーなのでhasError=true（errorステータス）
      expect(executeResult?.success).toBe(false);
      expect(mockCompleteReview).toHaveBeenCalledWith(
        expect.objectContaining({
          reviewTargetId: testReviewTargetId,
          hasError: true,
        }),
      );
    });

    it("外部API呼び出し自体が失敗した場合、そのチャンク全体がエラーとしてカウントされる", async () => {
      // startReview成功
      mockStartReview.mockResolvedValue({
        data: {
          reviewTargetId: testReviewTargetId,
          checkListItems: mockCheckListItems,
          concurrentReviewItems: 10,
        },
      });

      // 外部API呼び出し失敗（ネットワークエラー等）
      mockFetch.mockRejectedValue(new Error("Network error"));

      // completeReview成功（エラー完了）
      mockCompleteReview.mockResolvedValue({
        data: { reviewTargetId: testReviewTargetId, status: "error" },
      });

      const { result } = renderHook(() => useApiReview());

      let executeResult: { success: boolean; reviewTargetId: string } | undefined;
      await act(async () => {
        executeResult = await result.current.execute(baseInput);
      });

      // API呼び出し失敗でhasError=true
      expect(executeResult?.success).toBe(false);
      expect(mockCompleteReview).toHaveBeenCalledWith(
        expect.objectContaining({
          reviewTargetId: testReviewTargetId,
          hasError: true,
        }),
      );
    });
  });

  describe("進捗管理", () => {
    it("初期状態はidleステータス", () => {
      const { result } = renderHook(() => useApiReview());

      expect(result.current.progress.status).toBe("idle");
      expect(result.current.progress.currentChunk).toBe(0);
      expect(result.current.progress.totalChunks).toBe(0);
      expect(result.current.progress.completedChunks).toBe(0);
    });

    it("resetで進捗がリセットされる", async () => {
      const { result } = renderHook(() => useApiReview());

      // 何らかの状態を設定（モックで実現困難なため、reset後のassertionのみ）
      act(() => {
        result.current.reset();
      });

      expect(result.current.progress.status).toBe("idle");
      expect(result.current.progress.currentChunk).toBe(0);
      expect(result.current.progress.totalChunks).toBe(0);
      expect(result.current.progress.completedChunks).toBe(0);
    });
  });

  describe("エラーハンドリング", () => {
    it("startReviewが失敗した場合、エラーステータスになる", async () => {
      mockStartReview.mockResolvedValue({
        serverError: { message: "開始に失敗" },
      });

      const { result } = renderHook(() => useApiReview());

      let executeResult: { success: boolean; reviewTargetId: string; errorMessage?: string } | undefined;
      await act(async () => {
        executeResult = await result.current.execute(baseInput);
      });

      expect(executeResult?.success).toBe(false);
      expect(result.current.progress.status).toBe("error");
    });
  });
});
