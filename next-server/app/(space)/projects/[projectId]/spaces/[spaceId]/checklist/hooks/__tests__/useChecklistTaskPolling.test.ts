import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useChecklistTaskPolling,
  POLLING_INTERVAL,
  TASK_STATUS,
} from "../useChecklistTaskPolling";

// next/navigation のモック
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}));

describe("useChecklistTaskPolling", () => {
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

    it("キュー待機中ステータスがqueuedである", () => {
      expect(TASK_STATUS.QUEUED).toBe("queued");
    });

    it("処理中ステータスがprocessingである", () => {
      expect(TASK_STATUS.PROCESSING).toBe("processing");
    });
  });

  describe("正常系", () => {
    describe("isPollingの値", () => {
      it('taskStatus === "queued"の場合、isPollingがtrueになる', () => {
        const { result } = renderHook(() =>
          useChecklistTaskPolling({ taskStatus: "queued" }),
        );

        expect(result.current.isPolling).toBe(true);
      });

      it('taskStatus === "processing"の場合、isPollingがtrueになる', () => {
        const { result } = renderHook(() =>
          useChecklistTaskPolling({ taskStatus: "processing" }),
        );

        expect(result.current.isPolling).toBe(true);
      });

      it("taskStatus === nullの場合、isPollingがfalseになる", () => {
        const { result } = renderHook(() =>
          useChecklistTaskPolling({ taskStatus: null }),
        );

        expect(result.current.isPolling).toBe(false);
      });

      it('taskStatus === "completed"の場合、isPollingがfalseになる', () => {
        const { result } = renderHook(() =>
          useChecklistTaskPolling({ taskStatus: "completed" }),
        );

        expect(result.current.isPolling).toBe(false);
      });
    });

    describe("ポーリング動作", () => {
      it('taskStatus === "queued"の場合、10秒間隔でrouter.refresh()が呼ばれる', async () => {
        renderHook(() => useChecklistTaskPolling({ taskStatus: "queued" }));

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
      });

      it('taskStatus === "processing"の場合、10秒間隔でrouter.refresh()が呼ばれる', async () => {
        renderHook(() => useChecklistTaskPolling({ taskStatus: "processing" }));

        // 初期状態では呼ばれていない
        expect(mockRefresh).not.toHaveBeenCalled();

        // 10秒経過
        await act(async () => {
          vi.advanceTimersByTime(POLLING_INTERVAL);
        });
        expect(mockRefresh).toHaveBeenCalledTimes(1);
      });

      it("taskStatus === nullの場合、router.refresh()は呼ばれない", async () => {
        renderHook(() => useChecklistTaskPolling({ taskStatus: null }));

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

      it("ステータスがprocessingからnullに変わった場合、ポーリングが停止する", async () => {
        const { rerender } = renderHook(
          ({ taskStatus }) => useChecklistTaskPolling({ taskStatus }),
          { initialProps: { taskStatus: "processing" as string | null } },
        );

        // ポーリング開始を確認
        await act(async () => {
          vi.advanceTimersByTime(POLLING_INTERVAL);
        });
        expect(mockRefresh).toHaveBeenCalledTimes(1);

        // ステータスをnullに変更
        rerender({ taskStatus: null });

        // モックをリセットして、追加呼び出しがないことを確認
        mockRefresh.mockClear();

        // さらに10秒経過
        await act(async () => {
          vi.advanceTimersByTime(POLLING_INTERVAL);
        });
        expect(mockRefresh).not.toHaveBeenCalled();
      });

      it("ステータスがnullからqueuedに変わった場合、ポーリングが開始する", async () => {
        const { rerender } = renderHook(
          ({ taskStatus }) => useChecklistTaskPolling({ taskStatus }),
          { initialProps: { taskStatus: null as string | null } },
        );

        // ポーリングなしを確認
        await act(async () => {
          vi.advanceTimersByTime(POLLING_INTERVAL);
        });
        expect(mockRefresh).not.toHaveBeenCalled();

        // ステータスをqueuedに変更
        rerender({ taskStatus: "queued" });

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
        useChecklistTaskPolling({ taskStatus: "queued" }),
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
        ({ taskStatus }) => useChecklistTaskPolling({ taskStatus }),
        { initialProps: { taskStatus: "processing" as string | null } },
      );

      // 5秒経過（半分）
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      // ステータスを変更（インターバルがクリアされるはず）
      rerender({ taskStatus: null });

      // さらに5秒経過しても呼ばれない（古いインターバルがクリアされたため）
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });
      expect(mockRefresh).not.toHaveBeenCalled();
    });
  });

  describe("境界値テスト", () => {
    it("9999ミリ秒ではポーリングが発火しない", async () => {
      renderHook(() => useChecklistTaskPolling({ taskStatus: "queued" }));

      await act(async () => {
        vi.advanceTimersByTime(9999);
      });
      expect(mockRefresh).not.toHaveBeenCalled();
    });

    it("10000ミリ秒でちょうどポーリングが発火する", async () => {
      renderHook(() => useChecklistTaskPolling({ taskStatus: "queued" }));

      await act(async () => {
        vi.advanceTimersByTime(10000);
      });
      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });
  });
});
