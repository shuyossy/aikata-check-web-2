import { describe, it, expect } from "vitest";
import { ReviewResult } from "../ReviewResult";

describe("ReviewResult", () => {
  // テスト用の有効なUUID
  const testReviewTargetId = "550e8400-e29b-41d4-a716-446655440001";
  const testCheckListItemContent = "ドキュメントに目次が含まれているか確認";
  const testReviewResultId = "550e8400-e29b-41d4-a716-446655440003";

  describe("正常系", () => {
    describe("createSuccess", () => {
      it("成功したレビュー結果を作成できる", () => {
        const result = ReviewResult.createSuccess({
          reviewTargetId: testReviewTargetId,
          checkListItemContent: testCheckListItemContent,
          evaluation: "A",
          comment: "問題ありません",
        });

        expect(result.id).toBeDefined();
        expect(result.id.value).toBeTruthy();
        expect(result.reviewTargetId.value).toBe(testReviewTargetId);
        expect(result.checkListItemContent).toBe(testCheckListItemContent);
        expect(result.evaluation.value).toBe("A");
        expect(result.comment.value).toBe("問題ありません");
        expect(result.errorMessage).toBeNull();
        expect(result.createdAt).toBeInstanceOf(Date);
        expect(result.updatedAt).toBeInstanceOf(Date);
      });

      it("空の評価とコメントで成功結果を作成できる", () => {
        const result = ReviewResult.createSuccess({
          reviewTargetId: testReviewTargetId,
          checkListItemContent: testCheckListItemContent,
          evaluation: "",
          comment: "",
        });

        expect(result.evaluation.value).toBe("");
        expect(result.comment.value).toBe("");
        expect(result.errorMessage).toBeNull();
      });
    });

    describe("createError", () => {
      it("エラーレビュー結果を作成できる", () => {
        const result = ReviewResult.createError({
          reviewTargetId: testReviewTargetId,
          checkListItemContent: testCheckListItemContent,
          errorMessage: "AIの出力にレビュー結果が含まれませんでした",
        });

        expect(result.id).toBeDefined();
        expect(result.id.value).toBeTruthy();
        expect(result.reviewTargetId.value).toBe(testReviewTargetId);
        expect(result.checkListItemContent).toBe(testCheckListItemContent);
        expect(result.evaluation.value).toBeNull();
        expect(result.comment.value).toBeNull();
        expect(result.errorMessage).toBe(
          "AIの出力にレビュー結果が含まれませんでした",
        );
        expect(result.createdAt).toBeInstanceOf(Date);
        expect(result.updatedAt).toBeInstanceOf(Date);
      });
    });

    describe("reconstruct", () => {
      it("成功結果をDBから復元できる", () => {
        const now = new Date();
        const result = ReviewResult.reconstruct({
          id: testReviewResultId,
          reviewTargetId: testReviewTargetId,
          checkListItemContent: testCheckListItemContent,
          evaluation: "B",
          comment: "一部改善が必要です",
          errorMessage: null,
          createdAt: now,
          updatedAt: now,
        });

        expect(result.id.value).toBe(testReviewResultId);
        expect(result.reviewTargetId.value).toBe(testReviewTargetId);
        expect(result.checkListItemContent).toBe(testCheckListItemContent);
        expect(result.evaluation.value).toBe("B");
        expect(result.comment.value).toBe("一部改善が必要です");
        expect(result.errorMessage).toBeNull();
        expect(result.createdAt).toBe(now);
        expect(result.updatedAt).toBe(now);
      });

      it("エラー結果をDBから復元できる", () => {
        const now = new Date();
        const result = ReviewResult.reconstruct({
          id: testReviewResultId,
          reviewTargetId: testReviewTargetId,
          checkListItemContent: testCheckListItemContent,
          evaluation: null,
          comment: null,
          errorMessage: "トークン上限到達",
          createdAt: now,
          updatedAt: now,
        });

        expect(result.id.value).toBe(testReviewResultId);
        expect(result.evaluation.value).toBeNull();
        expect(result.comment.value).toBeNull();
        expect(result.errorMessage).toBe("トークン上限到達");
      });
    });

    describe("isSuccess", () => {
      it("成功結果の場合trueを返す", () => {
        const result = ReviewResult.createSuccess({
          reviewTargetId: testReviewTargetId,
          checkListItemContent: testCheckListItemContent,
          evaluation: "A",
          comment: "問題ありません",
        });

        expect(result.isSuccess()).toBe(true);
      });

      it("エラー結果の場合falseを返す", () => {
        const result = ReviewResult.createError({
          reviewTargetId: testReviewTargetId,
          checkListItemContent: testCheckListItemContent,
          errorMessage: "エラー",
        });

        expect(result.isSuccess()).toBe(false);
      });
    });

    describe("isError", () => {
      it("エラー結果の場合trueを返す", () => {
        const result = ReviewResult.createError({
          reviewTargetId: testReviewTargetId,
          checkListItemContent: testCheckListItemContent,
          errorMessage: "エラー",
        });

        expect(result.isError()).toBe(true);
      });

      it("成功結果の場合falseを返す", () => {
        const result = ReviewResult.createSuccess({
          reviewTargetId: testReviewTargetId,
          checkListItemContent: testCheckListItemContent,
          evaluation: "A",
          comment: "問題ありません",
        });

        expect(result.isError()).toBe(false);
      });
    });

    describe("toDto", () => {
      it("成功結果をDTOに変換できる", () => {
        const result = ReviewResult.createSuccess({
          reviewTargetId: testReviewTargetId,
          checkListItemContent: testCheckListItemContent,
          evaluation: "A",
          comment: "問題ありません",
        });

        const dto = result.toDto();

        expect(dto.id).toBe(result.id.value);
        expect(dto.reviewTargetId).toBe(testReviewTargetId);
        expect(dto.checkListItemContent).toBe(testCheckListItemContent);
        expect(dto.evaluation).toBe("A");
        expect(dto.comment).toBe("問題ありません");
        expect(dto.errorMessage).toBeNull();
        expect(dto.createdAt).toBeInstanceOf(Date);
        expect(dto.updatedAt).toBeInstanceOf(Date);
      });

      it("エラー結果をDTOに変換できる", () => {
        const result = ReviewResult.createError({
          reviewTargetId: testReviewTargetId,
          checkListItemContent: testCheckListItemContent,
          errorMessage: "処理失敗",
        });

        const dto = result.toDto();

        expect(dto.id).toBe(result.id.value);
        expect(dto.reviewTargetId).toBe(testReviewTargetId);
        expect(dto.checkListItemContent).toBe(testCheckListItemContent);
        expect(dto.evaluation).toBeNull();
        expect(dto.comment).toBeNull();
        expect(dto.errorMessage).toBe("処理失敗");
      });
    });

    describe("ゲッター", () => {
      it("全てのゲッターが正しく値を返す", () => {
        const now = new Date();
        const result = ReviewResult.reconstruct({
          id: testReviewResultId,
          reviewTargetId: testReviewTargetId,
          checkListItemContent: testCheckListItemContent,
          evaluation: "C",
          comment: "要改善",
          errorMessage: null,
          createdAt: now,
          updatedAt: now,
        });

        expect(result.id.value).toBe(testReviewResultId);
        expect(result.reviewTargetId.value).toBe(testReviewTargetId);
        expect(result.checkListItemContent).toBe(testCheckListItemContent);
        expect(result.evaluation.value).toBe("C");
        expect(result.comment.value).toBe("要改善");
        expect(result.errorMessage).toBeNull();
        expect(result.createdAt).toBe(now);
        expect(result.updatedAt).toBe(now);
      });
    });
  });

  describe("境界値テスト", () => {
    it("評価ラベルが20文字ちょうどでも成功結果を作成できる", () => {
      const longEvaluation = "あ".repeat(20);
      const result = ReviewResult.createSuccess({
        reviewTargetId: testReviewTargetId,
        checkListItemContent: testCheckListItemContent,
        evaluation: longEvaluation,
        comment: "テスト",
      });

      expect(result.evaluation.value).toBe(longEvaluation);
    });

    it("長いチェック項目内容でも成功結果を作成できる", () => {
      const longContent = "あ".repeat(10000);
      const result = ReviewResult.createSuccess({
        reviewTargetId: testReviewTargetId,
        checkListItemContent: longContent,
        evaluation: "A",
        comment: "テスト",
      });

      expect(result.checkListItemContent).toBe(longContent);
    });
  });
});
