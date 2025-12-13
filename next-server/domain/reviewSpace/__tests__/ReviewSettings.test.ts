import { describe, it, expect } from "vitest";
import {
  ReviewSettings,
  ReviewSettingsProps,
  DEFAULT_CONCURRENT_REVIEW_ITEMS,
  DEFAULT_COMMENT_FORMAT,
} from "../ReviewSettings";
import { DEFAULT_EVALUATION_CRITERIA } from "../EvaluationCriteria";

describe("ReviewSettings", () => {
  // テスト用の有効なレビュー設定
  const validProps: ReviewSettingsProps = {
    additionalInstructions: "セキュリティに注意してレビューしてください",
    concurrentReviewItems: 5,
    commentFormat: "【評価理由】\n【改善提案】",
    evaluationCriteria: DEFAULT_EVALUATION_CRITERIA,
  };

  describe("正常系", () => {
    describe("create", () => {
      it("すべてのプロパティを持つレビュー設定を生成できる", () => {
        const settings = ReviewSettings.create(validProps);

        expect(settings.additionalInstructions).toBe(validProps.additionalInstructions);
        expect(settings.concurrentReviewItems).toBe(validProps.concurrentReviewItems);
        expect(settings.commentFormat).toBe(validProps.commentFormat);
        expect(settings.evaluationCriteria).not.toBeNull();
        expect(settings.evaluationCriteria?.items.length).toBe(4);
      });

      it("必須プロパティがnullの場合はデフォルト値が使用される", () => {
        const settings = ReviewSettings.create({
          additionalInstructions: null,
          concurrentReviewItems: null,
          commentFormat: null,
          evaluationCriteria: null,
        });

        expect(settings.additionalInstructions).toBeNull();
        // 必須フィールドはデフォルト値が使用される
        expect(settings.concurrentReviewItems).toBe(DEFAULT_CONCURRENT_REVIEW_ITEMS);
        expect(settings.commentFormat).toBe(DEFAULT_COMMENT_FORMAT);
        expect(settings.evaluationCriteria.items.length).toBe(4);
      });

      it("空のオブジェクトでもデフォルト値が設定される", () => {
        const settings = ReviewSettings.create({});

        expect(settings.additionalInstructions).toBeNull();
        // 必須フィールドはデフォルト値が使用される
        expect(settings.concurrentReviewItems).toBe(DEFAULT_CONCURRENT_REVIEW_ITEMS);
        expect(settings.commentFormat).toBe(DEFAULT_COMMENT_FORMAT);
        expect(settings.evaluationCriteria.items.length).toBe(4);
      });

      it("追加指示が2000文字ちょうどは有効", () => {
        const longInstructions = "あ".repeat(2000);
        const settings = ReviewSettings.create({
          additionalInstructions: longInstructions,
        });

        expect(settings.additionalInstructions).toBe(longInstructions);
      });

      it("同時レビュー項目数が1の場合は有効", () => {
        const settings = ReviewSettings.create({
          concurrentReviewItems: 1,
        });

        expect(settings.concurrentReviewItems).toBe(1);
      });

      it("同時レビュー項目数が100の場合は有効", () => {
        const settings = ReviewSettings.create({
          concurrentReviewItems: 100,
        });

        expect(settings.concurrentReviewItems).toBe(100);
      });

      it("コメントフォーマットが2000文字ちょうどは有効", () => {
        const longFormat = "あ".repeat(2000);
        const settings = ReviewSettings.create({
          commentFormat: longFormat,
        });

        expect(settings.commentFormat).toBe(longFormat);
      });
    });

    describe("createDefault", () => {
      it("デフォルトのレビュー設定を生成できる", () => {
        const settings = ReviewSettings.createDefault();

        expect(settings.additionalInstructions).toBeNull();
        expect(settings.concurrentReviewItems).toBe(DEFAULT_CONCURRENT_REVIEW_ITEMS);
        expect(settings.commentFormat).toBe(DEFAULT_COMMENT_FORMAT);
        expect(settings.evaluationCriteria).not.toBeNull();
        expect(settings.evaluationCriteria?.items.length).toBe(4);
        expect(settings.evaluationCriteria?.items[0].label).toBe("A");
      });

      it("デフォルトの同時レビュー項目数は1である", () => {
        expect(DEFAULT_CONCURRENT_REVIEW_ITEMS).toBe(1);
      });

      it("デフォルトのコメントフォーマットが正しい形式である", () => {
        expect(DEFAULT_COMMENT_FORMAT).toContain("【評価理由・根拠】");
        expect(DEFAULT_COMMENT_FORMAT).toContain("【改善提案】");
      });
    });

    describe("reconstruct", () => {
      it("既存データから復元できる", () => {
        const settings = ReviewSettings.reconstruct(validProps);

        expect(settings.additionalInstructions).toBe(validProps.additionalInstructions);
        expect(settings.concurrentReviewItems).toBe(validProps.concurrentReviewItems);
      });
    });

    describe("toDto", () => {
      it("DTOに変換できる", () => {
        const settings = ReviewSettings.create(validProps);
        const dto = settings.toDto();

        expect(dto.additionalInstructions).toBe(validProps.additionalInstructions);
        expect(dto.concurrentReviewItems).toBe(validProps.concurrentReviewItems);
        expect(dto.commentFormat).toBe(validProps.commentFormat);
        expect(dto.evaluationCriteria).toEqual(validProps.evaluationCriteria);
      });

      it("デフォルト値を持つ設定もDTOに変換できる", () => {
        const settings = ReviewSettings.create({});
        const dto = settings.toDto();

        expect(dto.additionalInstructions).toBeNull();
        // 必須フィールドはデフォルト値が設定される
        expect(dto.concurrentReviewItems).toBe(DEFAULT_CONCURRENT_REVIEW_ITEMS);
        expect(dto.commentFormat).toBe(DEFAULT_COMMENT_FORMAT);
        expect(dto.evaluationCriteria.length).toBe(4);
      });
    });

    describe("equals", () => {
      it("同じ値を持つReviewSettingsは等しい", () => {
        const settings1 = ReviewSettings.create(validProps);
        const settings2 = ReviewSettings.create(validProps);

        expect(settings1.equals(settings2)).toBe(true);
      });

      it("異なる値を持つReviewSettingsは等しくない", () => {
        const settings1 = ReviewSettings.create(validProps);
        const settings2 = ReviewSettings.create({
          ...validProps,
          concurrentReviewItems: 10,
        });

        expect(settings1.equals(settings2)).toBe(false);
      });

      it("両方デフォルト値の場合は等しい", () => {
        const settings1 = ReviewSettings.create({});
        const settings2 = ReviewSettings.create({});

        expect(settings1.equals(settings2)).toBe(true);
      });
    });
  });

  describe("異常系", () => {
    describe("create", () => {
      it("追加指示が2001文字以上の場合はエラーをスローする", () => {
        const tooLongInstructions = "あ".repeat(2001);

        expect(() =>
          ReviewSettings.create({
            additionalInstructions: tooLongInstructions,
          }),
        ).toThrow();
      });

      it("同時レビュー項目数が0の場合はエラーをスローする", () => {
        expect(() =>
          ReviewSettings.create({
            concurrentReviewItems: 0,
          }),
        ).toThrow();
      });

      it("同時レビュー項目数が負の値の場合はエラーをスローする", () => {
        expect(() =>
          ReviewSettings.create({
            concurrentReviewItems: -1,
          }),
        ).toThrow();
      });

      it("同時レビュー項目数が101以上の場合はエラーをスローする", () => {
        expect(() =>
          ReviewSettings.create({
            concurrentReviewItems: 101,
          }),
        ).toThrow();
      });

      it("コメントフォーマットが2001文字以上の場合はエラーをスローする", () => {
        const tooLongFormat = "あ".repeat(2001);

        expect(() =>
          ReviewSettings.create({
            commentFormat: tooLongFormat,
          }),
        ).toThrow();
      });

      it("無効な評定基準の場合はエラーをスローする", () => {
        expect(() =>
          ReviewSettings.create({
            evaluationCriteria: [],
          }),
        ).toThrow();
      });
    });
  });
});
