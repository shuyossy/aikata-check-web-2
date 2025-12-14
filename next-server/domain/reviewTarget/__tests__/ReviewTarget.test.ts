import { describe, it, expect } from "vitest";
import { ReviewTarget } from "../ReviewTarget";
import { REVIEW_TARGET_STATUS } from "../ReviewTargetStatus";
import { REVIEW_TYPE, ReviewType } from "../ReviewType";
import { DEFAULT_EVALUATION_CRITERIA } from "@/domain/reviewSpace/EvaluationCriteria";
import { ReviewSettings } from "@/domain/reviewSpace/ReviewSettings";

describe("ReviewTarget", () => {
  // テスト用の有効なUUID
  const testReviewSpaceId = "550e8400-e29b-41d4-a716-446655440001";
  const testReviewTargetId = "550e8400-e29b-41d4-a716-446655440002";

  // テスト用のレビュー設定
  const testReviewSettings = {
    additionalInstructions: "セキュリティに注意してレビューしてください",
    concurrentReviewItems: 5,
    commentFormat: "【評価理由】\n【改善提案】",
    evaluationCriteria: DEFAULT_EVALUATION_CRITERIA,
  };

  describe("正常系", () => {
    describe("create", () => {
      it("レビュー対象を生成できる（初期ステータス: pending）", () => {
        const reviewTarget = ReviewTarget.create({
          reviewSpaceId: testReviewSpaceId,
          name: "テストレビュー対象",
        });

        expect(reviewTarget.id).toBeDefined();
        expect(reviewTarget.id.value).toBeTruthy();
        expect(reviewTarget.reviewSpaceId.value).toBe(testReviewSpaceId);
        expect(reviewTarget.name.value).toBe("テストレビュー対象");
        expect(reviewTarget.status.isPending()).toBe(true);
        expect(reviewTarget.reviewSettings).toBeNull();
        expect(reviewTarget.createdAt).toBeInstanceOf(Date);
        expect(reviewTarget.updatedAt).toBeInstanceOf(Date);
      });

      it("レビュー設定付きでレビュー対象を生成できる", () => {
        const reviewTarget = ReviewTarget.create({
          reviewSpaceId: testReviewSpaceId,
          name: "テストレビュー対象",
          reviewSettings: testReviewSettings,
        });

        expect(reviewTarget.reviewSettings).not.toBeNull();
        expect(reviewTarget.reviewSettings?.additionalInstructions).toBe(
          testReviewSettings.additionalInstructions,
        );
        expect(reviewTarget.reviewSettings?.concurrentReviewItems).toBe(
          testReviewSettings.concurrentReviewItems,
        );
      });

      it("レビュー設定がnullでレビュー対象を生成できる", () => {
        const reviewTarget = ReviewTarget.create({
          reviewSpaceId: testReviewSpaceId,
          name: "テストレビュー対象",
          reviewSettings: null,
        });

        expect(reviewTarget.reviewSettings).toBeNull();
      });
    });

    describe("reconstruct", () => {
      it("DBから取得したデータからレビュー対象を復元できる", () => {
        const now = new Date();
        const reviewTarget = ReviewTarget.reconstruct({
          id: testReviewTargetId,
          reviewSpaceId: testReviewSpaceId,
          name: "復元テスト",
          status: "reviewing",
          reviewSettings: testReviewSettings,
          reviewType: "small",
          createdAt: now,
          updatedAt: now,
        });

        expect(reviewTarget.id.value).toBe(testReviewTargetId);
        expect(reviewTarget.reviewSpaceId.value).toBe(testReviewSpaceId);
        expect(reviewTarget.name.value).toBe("復元テスト");
        expect(reviewTarget.status.isReviewing()).toBe(true);
        expect(reviewTarget.reviewSettings).not.toBeNull();
        expect(reviewTarget.reviewType?.value).toBe(REVIEW_TYPE.SMALL);
        expect(reviewTarget.createdAt).toBe(now);
        expect(reviewTarget.updatedAt).toBe(now);
      });

      it("レビュー設定なしで復元できる", () => {
        const now = new Date();
        const reviewTarget = ReviewTarget.reconstruct({
          id: testReviewTargetId,
          reviewSpaceId: testReviewSpaceId,
          name: "復元テスト",
          status: "pending",
          reviewSettings: null,
          reviewType: null,
          createdAt: now,
          updatedAt: now,
        });

        expect(reviewTarget.reviewSettings).toBeNull();
        expect(reviewTarget.reviewType).toBeNull();
      });
    });

    describe("状態遷移", () => {
      it("startReviewing()でステータスがreviewingに遷移する", () => {
        const reviewTarget = ReviewTarget.create({
          reviewSpaceId: testReviewSpaceId,
          name: "テストレビュー対象",
        });

        const reviewingTarget = reviewTarget.startReviewing();

        expect(reviewingTarget.status.isReviewing()).toBe(true);
        // 新しいインスタンスが返される（不変性）
        expect(reviewTarget.status.isPending()).toBe(true);
        // updatedAtが更新される
        expect(reviewingTarget.updatedAt.getTime()).toBeGreaterThanOrEqual(
          reviewTarget.updatedAt.getTime(),
        );
      });

      it("completeReview()でステータスがcompletedに遷移する", () => {
        const reviewTarget = ReviewTarget.create({
          reviewSpaceId: testReviewSpaceId,
          name: "テストレビュー対象",
        });

        const reviewingTarget = reviewTarget.startReviewing();
        const completedTarget = reviewingTarget.completeReview();

        expect(completedTarget.status.isCompleted()).toBe(true);
        expect(reviewingTarget.status.isReviewing()).toBe(true);
      });

      it("markAsError()でステータスがerrorに遷移する（pendingから）", () => {
        const reviewTarget = ReviewTarget.create({
          reviewSpaceId: testReviewSpaceId,
          name: "テストレビュー対象",
        });

        const errorTarget = reviewTarget.markAsError();

        expect(errorTarget.status.isError()).toBe(true);
        expect(reviewTarget.status.isPending()).toBe(true);
      });

      it("markAsError()でステータスがerrorに遷移する（reviewingから）", () => {
        const reviewTarget = ReviewTarget.create({
          reviewSpaceId: testReviewSpaceId,
          name: "テストレビュー対象",
        });

        const reviewingTarget = reviewTarget.startReviewing();
        const errorTarget = reviewingTarget.markAsError();

        expect(errorTarget.status.isError()).toBe(true);
      });
    });

    describe("canDelete", () => {
      it("pending状態では削除可能（true）", () => {
        const reviewTarget = ReviewTarget.create({
          reviewSpaceId: testReviewSpaceId,
          name: "テストレビュー対象",
        });

        expect(reviewTarget.canDelete()).toBe(true);
      });

      it("reviewing状態では削除不可（false）", () => {
        const reviewTarget = ReviewTarget.create({
          reviewSpaceId: testReviewSpaceId,
          name: "テストレビュー対象",
        });

        const reviewingTarget = reviewTarget.startReviewing();

        expect(reviewingTarget.canDelete()).toBe(false);
      });

      it("completed状態では削除可能（true）", () => {
        const reviewTarget = ReviewTarget.create({
          reviewSpaceId: testReviewSpaceId,
          name: "テストレビュー対象",
        });

        const completedTarget = reviewTarget
          .startReviewing()
          .completeReview();

        expect(completedTarget.canDelete()).toBe(true);
      });

      it("error状態では削除可能（true）", () => {
        const reviewTarget = ReviewTarget.create({
          reviewSpaceId: testReviewSpaceId,
          name: "テストレビュー対象",
        });

        const errorTarget = reviewTarget.markAsError();

        expect(errorTarget.canDelete()).toBe(true);
      });
    });

    describe("canRetry", () => {
      it("pending状態ではリトライ不可（false）", () => {
        const reviewTarget = ReviewTarget.create({
          reviewSpaceId: testReviewSpaceId,
          name: "テストレビュー対象",
        });

        expect(reviewTarget.canRetry()).toBe(false);
      });

      it("reviewing状態ではリトライ不可（false）", () => {
        const reviewTarget = ReviewTarget.create({
          reviewSpaceId: testReviewSpaceId,
          name: "テストレビュー対象",
        });

        const reviewingTarget = reviewTarget.startReviewing();

        expect(reviewingTarget.canRetry()).toBe(false);
      });

      it("completed状態ではリトライ可能（true）", () => {
        const reviewTarget = ReviewTarget.create({
          reviewSpaceId: testReviewSpaceId,
          name: "テストレビュー対象",
        });

        const completedTarget = reviewTarget.startReviewing().completeReview();

        expect(completedTarget.canRetry()).toBe(true);
      });

      it("error状態ではリトライ可能（true）", () => {
        const reviewTarget = ReviewTarget.create({
          reviewSpaceId: testReviewSpaceId,
          name: "テストレビュー対象",
        });

        const errorTarget = reviewTarget.markAsError();

        expect(errorTarget.canRetry()).toBe(true);
      });
    });

    describe("prepareForRetry", () => {
      it("completed状態からreviewingに遷移できる", () => {
        const reviewTarget = ReviewTarget.create({
          reviewSpaceId: testReviewSpaceId,
          name: "テストレビュー対象",
        });

        const completedTarget = reviewTarget.startReviewing().completeReview();
        const retryTarget = completedTarget.prepareForRetry();

        expect(retryTarget.status.isReviewing()).toBe(true);
        // 不変性の確認
        expect(completedTarget.status.isCompleted()).toBe(true);
      });

      it("error状態からreviewingに遷移できる", () => {
        const reviewTarget = ReviewTarget.create({
          reviewSpaceId: testReviewSpaceId,
          name: "テストレビュー対象",
        });

        const errorTarget = reviewTarget.markAsError();
        const retryTarget = errorTarget.prepareForRetry();

        expect(retryTarget.status.isReviewing()).toBe(true);
        // 不変性の確認
        expect(errorTarget.status.isError()).toBe(true);
      });
    });

    describe("withUpdatedSettings", () => {
      it("レビュー設定を更新した新しいインスタンスを返す", () => {
        const reviewTarget = ReviewTarget.create({
          reviewSpaceId: testReviewSpaceId,
          name: "テストレビュー対象",
        });

        const newSettings = ReviewSettings.create({
          additionalInstructions: "新しい指示",
          concurrentReviewItems: 10,
          commentFormat: "新しいフォーマット",
          evaluationCriteria: DEFAULT_EVALUATION_CRITERIA,
        });

        const updatedTarget = reviewTarget.withUpdatedSettings(newSettings);

        expect(updatedTarget.reviewSettings?.additionalInstructions).toBe(
          "新しい指示",
        );
        // 不変性の確認
        expect(reviewTarget.reviewSettings).toBeNull();
      });

      it("設定をnullに更新できる", () => {
        const reviewTarget = ReviewTarget.create({
          reviewSpaceId: testReviewSpaceId,
          name: "テストレビュー対象",
          reviewSettings: testReviewSettings,
        });

        const updatedTarget = reviewTarget.withUpdatedSettings(null);

        expect(updatedTarget.reviewSettings).toBeNull();
        // 不変性の確認
        expect(reviewTarget.reviewSettings).not.toBeNull();
      });
    });

    describe("withReviewType", () => {
      it("レビュー種別を設定した新しいインスタンスを返す", () => {
        const reviewTarget = ReviewTarget.create({
          reviewSpaceId: testReviewSpaceId,
          name: "テストレビュー対象",
        });

        const reviewType = ReviewType.create("small");
        const updatedTarget = reviewTarget.withReviewType(reviewType);

        expect(updatedTarget.reviewType?.value).toBe(REVIEW_TYPE.SMALL);
        // 不変性の確認
        expect(reviewTarget.reviewType).toBeNull();
      });

      it("レビュー種別を変更できる", () => {
        const reviewTarget = ReviewTarget.create({
          reviewSpaceId: testReviewSpaceId,
          name: "テストレビュー対象",
          reviewType: "small",
        });

        const newReviewType = ReviewType.create("large");
        const updatedTarget = reviewTarget.withReviewType(newReviewType);

        expect(updatedTarget.reviewType?.value).toBe(REVIEW_TYPE.LARGE);
        // 不変性の確認
        expect(reviewTarget.reviewType?.value).toBe(REVIEW_TYPE.SMALL);
      });
    });

    describe("toDto", () => {
      it("DTOに変換できる", () => {
        const reviewTarget = ReviewTarget.create({
          reviewSpaceId: testReviewSpaceId,
          name: "テストレビュー対象",
          reviewSettings: testReviewSettings,
        });

        const dto = reviewTarget.toDto();

        expect(dto.id).toBe(reviewTarget.id.value);
        expect(dto.reviewSpaceId).toBe(testReviewSpaceId);
        expect(dto.name).toBe("テストレビュー対象");
        expect(dto.status).toBe(REVIEW_TARGET_STATUS.PENDING);
        expect(dto.reviewSettings).not.toBeNull();
        expect(dto.reviewSettings?.additionalInstructions).toBe(
          testReviewSettings.additionalInstructions,
        );
        expect(dto.createdAt).toBeInstanceOf(Date);
        expect(dto.updatedAt).toBeInstanceOf(Date);
      });

      it("レビュー設定なしでDTOに変換できる", () => {
        const reviewTarget = ReviewTarget.create({
          reviewSpaceId: testReviewSpaceId,
          name: "テストレビュー対象",
        });

        const dto = reviewTarget.toDto();

        expect(dto.reviewSettings).toBeNull();
      });
    });

    describe("toListItemDto", () => {
      it("一覧用DTOに変換できる", () => {
        const reviewTarget = ReviewTarget.create({
          reviewSpaceId: testReviewSpaceId,
          name: "テストレビュー対象",
        });

        const dto = reviewTarget.toListItemDto();

        expect(dto.id).toBe(reviewTarget.id.value);
        expect(dto.name).toBe("テストレビュー対象");
        expect(dto.status).toBe(REVIEW_TARGET_STATUS.PENDING);
        expect(dto.createdAt).toBeInstanceOf(Date);
        expect(dto.updatedAt).toBeInstanceOf(Date);
        // 一覧用DTOにはreviewSpaceIdやreviewSettingsは含まれない
        expect((dto as unknown as Record<string, unknown>).reviewSpaceId).toBeUndefined();
        expect((dto as unknown as Record<string, unknown>).reviewSettings).toBeUndefined();
      });
    });

    describe("ゲッター", () => {
      it("全てのゲッターが正しく値を返す", () => {
        const now = new Date();
        const reviewTarget = ReviewTarget.reconstruct({
          id: testReviewTargetId,
          reviewSpaceId: testReviewSpaceId,
          name: "ゲッターテスト",
          status: "completed",
          reviewSettings: testReviewSettings,
          reviewType: "large",
          createdAt: now,
          updatedAt: now,
        });

        expect(reviewTarget.id.value).toBe(testReviewTargetId);
        expect(reviewTarget.reviewSpaceId.value).toBe(testReviewSpaceId);
        expect(reviewTarget.name.value).toBe("ゲッターテスト");
        expect(reviewTarget.status.isCompleted()).toBe(true);
        expect(reviewTarget.reviewSettings?.additionalInstructions).toBe(
          testReviewSettings.additionalInstructions,
        );
        expect(reviewTarget.reviewType?.value).toBe(REVIEW_TYPE.LARGE);
        expect(reviewTarget.createdAt).toBe(now);
        expect(reviewTarget.updatedAt).toBe(now);
      });
    });
  });

  describe("異常系", () => {
    describe("不正なステータス遷移", () => {
      it("reviewing状態からstartReviewing()でエラーをスローする", () => {
        const reviewTarget = ReviewTarget.create({
          reviewSpaceId: testReviewSpaceId,
          name: "テストレビュー対象",
        });

        const reviewingTarget = reviewTarget.startReviewing();

        expect(() => reviewingTarget.startReviewing()).toThrow();
      });

      it("pending状態からcompleteReview()でエラーをスローする", () => {
        const reviewTarget = ReviewTarget.create({
          reviewSpaceId: testReviewSpaceId,
          name: "テストレビュー対象",
        });

        expect(() => reviewTarget.completeReview()).toThrow();
      });

      it("completed状態からmarkAsError()でエラーをスローする", () => {
        const reviewTarget = ReviewTarget.create({
          reviewSpaceId: testReviewSpaceId,
          name: "テストレビュー対象",
        });

        const completedTarget = reviewTarget
          .startReviewing()
          .completeReview();

        expect(() => completedTarget.markAsError()).toThrow();
      });
    });
  });
});
