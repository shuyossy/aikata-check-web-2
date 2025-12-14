import { describe, it, expect } from "vitest";
import {
  ReviewTargetStatus,
  REVIEW_TARGET_STATUS,
} from "../ReviewTargetStatus";

describe("ReviewTargetStatus", () => {
  describe("正常系", () => {
    describe("create", () => {
      it("pendingステータスで生成される", () => {
        const status = ReviewTargetStatus.create();

        expect(status.value).toBe(REVIEW_TARGET_STATUS.PENDING);
        expect(status.isPending()).toBe(true);
      });
    });

    describe("reconstruct", () => {
      it("pendingステータスを復元できる", () => {
        const status = ReviewTargetStatus.reconstruct("pending");

        expect(status.value).toBe(REVIEW_TARGET_STATUS.PENDING);
        expect(status.isPending()).toBe(true);
      });

      it("reviewingステータスを復元できる", () => {
        const status = ReviewTargetStatus.reconstruct("reviewing");

        expect(status.value).toBe(REVIEW_TARGET_STATUS.REVIEWING);
        expect(status.isReviewing()).toBe(true);
      });

      it("completedステータスを復元できる", () => {
        const status = ReviewTargetStatus.reconstruct("completed");

        expect(status.value).toBe(REVIEW_TARGET_STATUS.COMPLETED);
        expect(status.isCompleted()).toBe(true);
      });

      it("errorステータスを復元できる", () => {
        const status = ReviewTargetStatus.reconstruct("error");

        expect(status.value).toBe(REVIEW_TARGET_STATUS.ERROR);
        expect(status.isError()).toBe(true);
      });
    });

    describe("状態遷移", () => {
      it("pending → reviewing に遷移できる", () => {
        const pending = ReviewTargetStatus.create();
        const reviewing = pending.toReviewing();

        expect(reviewing.isReviewing()).toBe(true);
      });

      it("reviewing → completed に遷移できる", () => {
        const reviewing = ReviewTargetStatus.reconstruct("reviewing");
        const completed = reviewing.toCompleted();

        expect(completed.isCompleted()).toBe(true);
      });

      it("pending → error に遷移できる", () => {
        const pending = ReviewTargetStatus.create();
        const error = pending.toError();

        expect(error.isError()).toBe(true);
      });

      it("reviewing → error に遷移できる", () => {
        const reviewing = ReviewTargetStatus.reconstruct("reviewing");
        const error = reviewing.toError();

        expect(error.isError()).toBe(true);
      });
    });

    describe("判定メソッド", () => {
      it("isPending()はpending状態のときのみtrueを返す", () => {
        const pending = ReviewTargetStatus.reconstruct("pending");
        const reviewing = ReviewTargetStatus.reconstruct("reviewing");
        const completed = ReviewTargetStatus.reconstruct("completed");
        const error = ReviewTargetStatus.reconstruct("error");

        expect(pending.isPending()).toBe(true);
        expect(reviewing.isPending()).toBe(false);
        expect(completed.isPending()).toBe(false);
        expect(error.isPending()).toBe(false);
      });

      it("isReviewing()はreviewing状態のときのみtrueを返す", () => {
        const pending = ReviewTargetStatus.reconstruct("pending");
        const reviewing = ReviewTargetStatus.reconstruct("reviewing");
        const completed = ReviewTargetStatus.reconstruct("completed");
        const error = ReviewTargetStatus.reconstruct("error");

        expect(pending.isReviewing()).toBe(false);
        expect(reviewing.isReviewing()).toBe(true);
        expect(completed.isReviewing()).toBe(false);
        expect(error.isReviewing()).toBe(false);
      });

      it("isCompleted()はcompleted状態のときのみtrueを返す", () => {
        const pending = ReviewTargetStatus.reconstruct("pending");
        const reviewing = ReviewTargetStatus.reconstruct("reviewing");
        const completed = ReviewTargetStatus.reconstruct("completed");
        const error = ReviewTargetStatus.reconstruct("error");

        expect(pending.isCompleted()).toBe(false);
        expect(reviewing.isCompleted()).toBe(false);
        expect(completed.isCompleted()).toBe(true);
        expect(error.isCompleted()).toBe(false);
      });

      it("isError()はerror状態のときのみtrueを返す", () => {
        const pending = ReviewTargetStatus.reconstruct("pending");
        const reviewing = ReviewTargetStatus.reconstruct("reviewing");
        const completed = ReviewTargetStatus.reconstruct("completed");
        const error = ReviewTargetStatus.reconstruct("error");

        expect(pending.isError()).toBe(false);
        expect(reviewing.isError()).toBe(false);
        expect(completed.isError()).toBe(false);
        expect(error.isError()).toBe(true);
      });
    });

    describe("遷移可能判定メソッド", () => {
      it("canTransitionToReviewing()はpending状態のときのみtrueを返す", () => {
        const pending = ReviewTargetStatus.reconstruct("pending");
        const reviewing = ReviewTargetStatus.reconstruct("reviewing");
        const completed = ReviewTargetStatus.reconstruct("completed");
        const error = ReviewTargetStatus.reconstruct("error");

        expect(pending.canTransitionToReviewing()).toBe(true);
        expect(reviewing.canTransitionToReviewing()).toBe(false);
        expect(completed.canTransitionToReviewing()).toBe(false);
        expect(error.canTransitionToReviewing()).toBe(false);
      });

      it("canTransitionToCompleted()はreviewing状態のときのみtrueを返す", () => {
        const pending = ReviewTargetStatus.reconstruct("pending");
        const reviewing = ReviewTargetStatus.reconstruct("reviewing");
        const completed = ReviewTargetStatus.reconstruct("completed");
        const error = ReviewTargetStatus.reconstruct("error");

        expect(pending.canTransitionToCompleted()).toBe(false);
        expect(reviewing.canTransitionToCompleted()).toBe(true);
        expect(completed.canTransitionToCompleted()).toBe(false);
        expect(error.canTransitionToCompleted()).toBe(false);
      });

      it("canTransitionToError()はpendingまたはreviewing状態のときtrueを返す", () => {
        const pending = ReviewTargetStatus.reconstruct("pending");
        const reviewing = ReviewTargetStatus.reconstruct("reviewing");
        const completed = ReviewTargetStatus.reconstruct("completed");
        const error = ReviewTargetStatus.reconstruct("error");

        expect(pending.canTransitionToError()).toBe(true);
        expect(reviewing.canTransitionToError()).toBe(true);
        expect(completed.canTransitionToError()).toBe(false);
        expect(error.canTransitionToError()).toBe(false);
      });
    });

    describe("equals", () => {
      it("同じステータスを持つインスタンスは等しい", () => {
        const status1 = ReviewTargetStatus.reconstruct("pending");
        const status2 = ReviewTargetStatus.reconstruct("pending");

        expect(status1.equals(status2)).toBe(true);
      });

      it("異なるステータスを持つインスタンスは等しくない", () => {
        const pending = ReviewTargetStatus.reconstruct("pending");
        const reviewing = ReviewTargetStatus.reconstruct("reviewing");

        expect(pending.equals(reviewing)).toBe(false);
      });
    });

    describe("toString", () => {
      it("ステータス値を文字列で返す", () => {
        const pending = ReviewTargetStatus.reconstruct("pending");
        const reviewing = ReviewTargetStatus.reconstruct("reviewing");
        const completed = ReviewTargetStatus.reconstruct("completed");
        const error = ReviewTargetStatus.reconstruct("error");

        expect(pending.toString()).toBe("pending");
        expect(reviewing.toString()).toBe("reviewing");
        expect(completed.toString()).toBe("completed");
        expect(error.toString()).toBe("error");
      });
    });
  });

  describe("異常系", () => {
    describe("reconstruct", () => {
      it("無効なステータス値でエラーをスローする", () => {
        expect(() => ReviewTargetStatus.reconstruct("invalid")).toThrow();
      });

      it("空文字でエラーをスローする", () => {
        expect(() => ReviewTargetStatus.reconstruct("")).toThrow();
      });
    });

    describe("不正な状態遷移", () => {
      it("reviewing状態からtoReviewing()でエラーをスローする", () => {
        const reviewing = ReviewTargetStatus.reconstruct("reviewing");

        expect(() => reviewing.toReviewing()).toThrow();
      });

      it("completed状態からtoReviewing()でエラーをスローする", () => {
        const completed = ReviewTargetStatus.reconstruct("completed");

        expect(() => completed.toReviewing()).toThrow();
      });

      it("error状態からtoReviewing()でエラーをスローする", () => {
        const error = ReviewTargetStatus.reconstruct("error");

        expect(() => error.toReviewing()).toThrow();
      });

      it("pending状態からtoCompleted()でエラーをスローする", () => {
        const pending = ReviewTargetStatus.reconstruct("pending");

        expect(() => pending.toCompleted()).toThrow();
      });

      it("completed状態からtoCompleted()でエラーをスローする", () => {
        const completed = ReviewTargetStatus.reconstruct("completed");

        expect(() => completed.toCompleted()).toThrow();
      });

      it("error状態からtoCompleted()でエラーをスローする", () => {
        const error = ReviewTargetStatus.reconstruct("error");

        expect(() => error.toCompleted()).toThrow();
      });

      it("completed状態からtoError()でエラーをスローする", () => {
        const completed = ReviewTargetStatus.reconstruct("completed");

        expect(() => completed.toError()).toThrow();
      });

      it("error状態からtoError()でエラーをスローする", () => {
        const error = ReviewTargetStatus.reconstruct("error");

        expect(() => error.toError()).toThrow();
      });
    });
  });
});
