import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useReviewResultsPolling,
  POLLING_INTERVAL,
  REVIEWING_STATUS,
} from "../useReviewResultsPolling";

// next/navigation のモック
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}));

describe("useReviewResultsPolling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("定数", () => {
    it("ポーリング間隔が10秒（10000ミリ秒）である", () => {
      expect(POLLING_INTERVAL).toBe(10000);
    });

    it("レビュー実行中ステータスがreviewingである", () => {
      expect(REVIEWING_STATUS).toBe("reviewing");
    });
  });

  describe("正常系", () => {
    describe("isPollingの値", () => {
      it('status === "reviewing"の場合、isPollingがtrueになる', () => {
        const { result } = renderHook(() =>
          useReviewResultsPolling({ currentStatus: "reviewing" })
        );

        expect(result.current.isPolling).toBe(true);
      });

      it('status === "completed"の場合、isPollingがfalseになる', () => {
        const { result } = renderHook(() =>
          useReviewResultsPolling({ currentStatus: "completed" })
        );

        expect(result.current.isPolling).toBe(false);
      });

      it('status === "error"の場合、isPollingがfalseになる', () => {
        const { result } = renderHook(() =>
          useReviewResultsPolling({ currentStatus: "error" })
        );

        expect(result.current.isPolling).toBe(false);
      });

      it('status === "pending"の場合、isPollingがfalseになる', () => {
        const { result } = renderHook(() =>
          useReviewResultsPolling({ currentStatus: "pending" })
        );

        expect(result.current.isPolling).toBe(false);
      });
    });

    describe("ポーリング動作", () => {
      it('status === "reviewing"の場合、10秒間隔でrouter.refresh()が呼ばれる', async () => {
        renderHook(() =>
          useReviewResultsPolling({ currentStatus: "reviewing" })
        );

        // 初期状態では呼ばれていない
        expect(mockRefresh).not.toHaveBeenCalled();

        // 10秒経過
        await act(async () => {
          vi.advanceTimersByTime(POLLING_INTERVAL);
        });
        expect(mockRefresh).toHaveBeenCalledTimes(1);

        // さらに10秒経過（合計20秒）
        await act(async () => {
          vi.advanceTimersByTime(POLLING_INTERVAL);
        });
        expect(mockRefresh).toHaveBeenCalledTimes(2);

        // さらに10秒経過（合計30秒）
        await act(async () => {
          vi.advanceTimersByTime(POLLING_INTERVAL);
        });
        expect(mockRefresh).toHaveBeenCalledTimes(3);
      });

      it('status !== "reviewing"の場合、router.refresh()は呼ばれない', async () => {
        renderHook(() =>
          useReviewResultsPolling({ currentStatus: "completed" })
        );

        // 10秒経過
        await act(async () => {
          vi.advanceTimersByTime(POLLING_INTERVAL);
        });
        expect(mockRefresh).not.toHaveBeenCalled();

        // さらに10秒経過
        await act(async () => {
          vi.advanceTimersByTime(POLLING_INTERVAL);
        });
        expect(mockRefresh).not.toHaveBeenCalled();
      });

      it("ステータスがreviewingからcompletedに変わった場合、ポーリングが停止する", async () => {
        const { rerender } = renderHook(
          ({ currentStatus }) => useReviewResultsPolling({ currentStatus }),
          { initialProps: { currentStatus: "reviewing" } }
        );

        // ポーリング開始を確認
        await act(async () => {
          vi.advanceTimersByTime(POLLING_INTERVAL);
        });
        expect(mockRefresh).toHaveBeenCalledTimes(1);

        // ステータスをcompletedに変更
        rerender({ currentStatus: "completed" });

        // モックをリセットして、追加呼び出しがないことを確認
        mockRefresh.mockClear();

        // さらに10秒経過
        await act(async () => {
          vi.advanceTimersByTime(POLLING_INTERVAL);
        });
        expect(mockRefresh).not.toHaveBeenCalled();
      });

      it("ステータスがcompletedからreviewingに変わった場合、ポーリングが開始する", async () => {
        const { rerender } = renderHook(
          ({ currentStatus }) => useReviewResultsPolling({ currentStatus }),
          { initialProps: { currentStatus: "completed" } }
        );

        // ポーリングなしを確認
        await act(async () => {
          vi.advanceTimersByTime(POLLING_INTERVAL);
        });
        expect(mockRefresh).not.toHaveBeenCalled();

        // ステータスをreviewingに変更
        rerender({ currentStatus: "reviewing" });

        // 10秒経過でポーリング開始を確認
        await act(async () => {
          vi.advanceTimersByTime(POLLING_INTERVAL);
        });
        expect(mockRefresh).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("クリーンアップ処理", () => {
    it("コンポーネントアンマウント時にインターバルがクリアされる", async () => {
      const { unmount } = renderHook(() =>
        useReviewResultsPolling({ currentStatus: "reviewing" })
      );

      // アンマウント前に一度ポーリングを確認
      await act(async () => {
        vi.advanceTimersByTime(POLLING_INTERVAL);
      });
      expect(mockRefresh).toHaveBeenCalledTimes(1);

      // アンマウント
      unmount();

      // モックをリセット
      mockRefresh.mockClear();

      // 時間が経過してもrefreshは呼ばれない
      await act(async () => {
        vi.advanceTimersByTime(POLLING_INTERVAL);
      });
      expect(mockRefresh).not.toHaveBeenCalled();
    });

    it("ステータス変更時に古いインターバルがクリアされる", async () => {
      const { rerender } = renderHook(
        ({ currentStatus }) => useReviewResultsPolling({ currentStatus }),
        { initialProps: { currentStatus: "reviewing" } }
      );

      // 5秒経過（半分）
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      // ステータスを変更（インターバルがクリアされるはず）
      rerender({ currentStatus: "completed" });

      // さらに5秒経過しても呼ばれない（古いインターバルがクリアされたため）
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });
      expect(mockRefresh).not.toHaveBeenCalled();
    });
  });

  describe("境界値テスト", () => {
    it("9999ミリ秒ではポーリングが発火しない", async () => {
      renderHook(() =>
        useReviewResultsPolling({ currentStatus: "reviewing" })
      );

      await act(async () => {
        vi.advanceTimersByTime(9999);
      });
      expect(mockRefresh).not.toHaveBeenCalled();
    });

    it("10000ミリ秒でちょうどポーリングが発火する", async () => {
      renderHook(() =>
        useReviewResultsPolling({ currentStatus: "reviewing" })
      );

      await act(async () => {
        vi.advanceTimersByTime(10000);
      });
      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });
  });
});
