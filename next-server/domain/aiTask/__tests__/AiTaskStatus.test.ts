import { describe, it, expect } from "vitest";
import { AiTaskStatus, AI_TASK_STATUS } from "../AiTaskStatus";

describe("AiTaskStatus", () => {
  describe("正常系", () => {
    describe("create", () => {
      it("queuedステータスで生成される", () => {
        const status = AiTaskStatus.create();

        expect(status.value).toBe(AI_TASK_STATUS.QUEUED);
        expect(status.isQueued()).toBe(true);
      });
    });

    describe("reconstruct", () => {
      it("queuedステータスを復元できる", () => {
        const status = AiTaskStatus.reconstruct("queued");

        expect(status.value).toBe(AI_TASK_STATUS.QUEUED);
        expect(status.isQueued()).toBe(true);
      });

      it("processingステータスを復元できる", () => {
        const status = AiTaskStatus.reconstruct("processing");

        expect(status.value).toBe(AI_TASK_STATUS.PROCESSING);
        expect(status.isProcessing()).toBe(true);
      });

      it("completedステータスを復元できる", () => {
        const status = AiTaskStatus.reconstruct("completed");

        expect(status.value).toBe(AI_TASK_STATUS.COMPLETED);
        expect(status.isCompleted()).toBe(true);
      });

      it("failedステータスを復元できる", () => {
        const status = AiTaskStatus.reconstruct("failed");

        expect(status.value).toBe(AI_TASK_STATUS.FAILED);
        expect(status.isFailed()).toBe(true);
      });
    });

    describe("状態遷移", () => {
      it("queued → processing に遷移できる", () => {
        const queued = AiTaskStatus.create();
        const processing = queued.toProcessing();

        expect(processing.isProcessing()).toBe(true);
      });

      it("processing → completed に遷移できる", () => {
        const processing = AiTaskStatus.reconstruct("processing");
        const completed = processing.toCompleted();

        expect(completed.isCompleted()).toBe(true);
      });

      it("processing → failed に遷移できる", () => {
        const processing = AiTaskStatus.reconstruct("processing");
        const failed = processing.toFailed();

        expect(failed.isFailed()).toBe(true);
      });
    });

    describe("判定メソッド", () => {
      it("isQueued()はqueued状態のときのみtrueを返す", () => {
        const queued = AiTaskStatus.reconstruct("queued");
        const processing = AiTaskStatus.reconstruct("processing");
        const completed = AiTaskStatus.reconstruct("completed");
        const failed = AiTaskStatus.reconstruct("failed");

        expect(queued.isQueued()).toBe(true);
        expect(processing.isQueued()).toBe(false);
        expect(completed.isQueued()).toBe(false);
        expect(failed.isQueued()).toBe(false);
      });

      it("isProcessing()はprocessing状態のときのみtrueを返す", () => {
        const queued = AiTaskStatus.reconstruct("queued");
        const processing = AiTaskStatus.reconstruct("processing");
        const completed = AiTaskStatus.reconstruct("completed");
        const failed = AiTaskStatus.reconstruct("failed");

        expect(queued.isProcessing()).toBe(false);
        expect(processing.isProcessing()).toBe(true);
        expect(completed.isProcessing()).toBe(false);
        expect(failed.isProcessing()).toBe(false);
      });

      it("isCompleted()はcompleted状態のときのみtrueを返す", () => {
        const queued = AiTaskStatus.reconstruct("queued");
        const processing = AiTaskStatus.reconstruct("processing");
        const completed = AiTaskStatus.reconstruct("completed");
        const failed = AiTaskStatus.reconstruct("failed");

        expect(queued.isCompleted()).toBe(false);
        expect(processing.isCompleted()).toBe(false);
        expect(completed.isCompleted()).toBe(true);
        expect(failed.isCompleted()).toBe(false);
      });

      it("isFailed()はfailed状態のときのみtrueを返す", () => {
        const queued = AiTaskStatus.reconstruct("queued");
        const processing = AiTaskStatus.reconstruct("processing");
        const completed = AiTaskStatus.reconstruct("completed");
        const failed = AiTaskStatus.reconstruct("failed");

        expect(queued.isFailed()).toBe(false);
        expect(processing.isFailed()).toBe(false);
        expect(completed.isFailed()).toBe(false);
        expect(failed.isFailed()).toBe(true);
      });
    });

    describe("遷移可能判定メソッド", () => {
      it("canTransitionToProcessing()はqueued状態のときのみtrueを返す", () => {
        const queued = AiTaskStatus.reconstruct("queued");
        const processing = AiTaskStatus.reconstruct("processing");
        const completed = AiTaskStatus.reconstruct("completed");
        const failed = AiTaskStatus.reconstruct("failed");

        expect(queued.canTransitionToProcessing()).toBe(true);
        expect(processing.canTransitionToProcessing()).toBe(false);
        expect(completed.canTransitionToProcessing()).toBe(false);
        expect(failed.canTransitionToProcessing()).toBe(false);
      });

      it("canTransitionToCompleted()はprocessing状態のときのみtrueを返す", () => {
        const queued = AiTaskStatus.reconstruct("queued");
        const processing = AiTaskStatus.reconstruct("processing");
        const completed = AiTaskStatus.reconstruct("completed");
        const failed = AiTaskStatus.reconstruct("failed");

        expect(queued.canTransitionToCompleted()).toBe(false);
        expect(processing.canTransitionToCompleted()).toBe(true);
        expect(completed.canTransitionToCompleted()).toBe(false);
        expect(failed.canTransitionToCompleted()).toBe(false);
      });

      it("canTransitionToFailed()はprocessing状態のときのみtrueを返す", () => {
        const queued = AiTaskStatus.reconstruct("queued");
        const processing = AiTaskStatus.reconstruct("processing");
        const completed = AiTaskStatus.reconstruct("completed");
        const failed = AiTaskStatus.reconstruct("failed");

        expect(queued.canTransitionToFailed()).toBe(false);
        expect(processing.canTransitionToFailed()).toBe(true);
        expect(completed.canTransitionToFailed()).toBe(false);
        expect(failed.canTransitionToFailed()).toBe(false);
      });
    });

    describe("equals", () => {
      it("同じステータスを持つインスタンスは等しい", () => {
        const status1 = AiTaskStatus.reconstruct("queued");
        const status2 = AiTaskStatus.reconstruct("queued");

        expect(status1.equals(status2)).toBe(true);
      });

      it("異なるステータスを持つインスタンスは等しくない", () => {
        const queued = AiTaskStatus.reconstruct("queued");
        const processing = AiTaskStatus.reconstruct("processing");

        expect(queued.equals(processing)).toBe(false);
      });
    });

    describe("toString", () => {
      it("ステータス値を文字列で返す", () => {
        const queued = AiTaskStatus.reconstruct("queued");
        const processing = AiTaskStatus.reconstruct("processing");
        const completed = AiTaskStatus.reconstruct("completed");
        const failed = AiTaskStatus.reconstruct("failed");

        expect(queued.toString()).toBe("queued");
        expect(processing.toString()).toBe("processing");
        expect(completed.toString()).toBe("completed");
        expect(failed.toString()).toBe("failed");
      });
    });
  });

  describe("異常系", () => {
    describe("reconstruct", () => {
      it("無効なステータス値でエラーをスローする", () => {
        expect(() => AiTaskStatus.reconstruct("invalid")).toThrow();
      });

      it("空文字でエラーをスローする", () => {
        expect(() => AiTaskStatus.reconstruct("")).toThrow();
      });
    });

    describe("不正な状態遷移", () => {
      // toProcessing()の不正遷移
      it("processing状態からtoProcessing()でエラーをスローする", () => {
        const processing = AiTaskStatus.reconstruct("processing");

        expect(() => processing.toProcessing()).toThrow();
      });

      it("completed状態からtoProcessing()でエラーをスローする", () => {
        const completed = AiTaskStatus.reconstruct("completed");

        expect(() => completed.toProcessing()).toThrow();
      });

      it("failed状態からtoProcessing()でエラーをスローする", () => {
        const failed = AiTaskStatus.reconstruct("failed");

        expect(() => failed.toProcessing()).toThrow();
      });

      // toCompleted()の不正遷移
      it("queued状態からtoCompleted()でエラーをスローする", () => {
        const queued = AiTaskStatus.reconstruct("queued");

        expect(() => queued.toCompleted()).toThrow();
      });

      it("completed状態からtoCompleted()でエラーをスローする", () => {
        const completed = AiTaskStatus.reconstruct("completed");

        expect(() => completed.toCompleted()).toThrow();
      });

      it("failed状態からtoCompleted()でエラーをスローする", () => {
        const failed = AiTaskStatus.reconstruct("failed");

        expect(() => failed.toCompleted()).toThrow();
      });

      // toFailed()の不正遷移
      it("queued状態からtoFailed()でエラーをスローする", () => {
        const queued = AiTaskStatus.reconstruct("queued");

        expect(() => queued.toFailed()).toThrow();
      });

      it("completed状態からtoFailed()でエラーをスローする", () => {
        const completed = AiTaskStatus.reconstruct("completed");

        expect(() => completed.toFailed()).toThrow();
      });

      it("failed状態からtoFailed()でエラーをスローする", () => {
        const failed = AiTaskStatus.reconstruct("failed");

        expect(() => failed.toFailed()).toThrow();
      });
    });
  });
});
