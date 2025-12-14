import { describe, it, expect } from "vitest";
import { ReviewType, REVIEW_TYPE } from "../ReviewType";

describe("ReviewType", () => {
  describe("正常系", () => {
    describe("create", () => {
      it("small種別で生成できる", () => {
        const reviewType = ReviewType.create("small");

        expect(reviewType.value).toBe(REVIEW_TYPE.SMALL);
        expect(reviewType.isSmall()).toBe(true);
        expect(reviewType.isLarge()).toBe(false);
      });

      it("large種別で生成できる", () => {
        const reviewType = ReviewType.create("large");

        expect(reviewType.value).toBe(REVIEW_TYPE.LARGE);
        expect(reviewType.isSmall()).toBe(false);
        expect(reviewType.isLarge()).toBe(true);
      });
    });

    describe("reconstruct", () => {
      it("small種別を復元できる", () => {
        const reviewType = ReviewType.reconstruct("small");

        expect(reviewType.value).toBe(REVIEW_TYPE.SMALL);
        expect(reviewType.isSmall()).toBe(true);
      });

      it("large種別を復元できる", () => {
        const reviewType = ReviewType.reconstruct("large");

        expect(reviewType.value).toBe(REVIEW_TYPE.LARGE);
        expect(reviewType.isLarge()).toBe(true);
      });
    });

    describe("判定メソッド", () => {
      it("isSmall()はsmall種別のときのみtrueを返す", () => {
        const small = ReviewType.reconstruct("small");
        const large = ReviewType.reconstruct("large");

        expect(small.isSmall()).toBe(true);
        expect(large.isSmall()).toBe(false);
      });

      it("isLarge()はlarge種別のときのみtrueを返す", () => {
        const small = ReviewType.reconstruct("small");
        const large = ReviewType.reconstruct("large");

        expect(small.isLarge()).toBe(false);
        expect(large.isLarge()).toBe(true);
      });
    });

    describe("equals", () => {
      it("同じ種別を持つインスタンスは等しい", () => {
        const type1 = ReviewType.reconstruct("small");
        const type2 = ReviewType.reconstruct("small");

        expect(type1.equals(type2)).toBe(true);
      });

      it("異なる種別を持つインスタンスは等しくない", () => {
        const small = ReviewType.reconstruct("small");
        const large = ReviewType.reconstruct("large");

        expect(small.equals(large)).toBe(false);
      });
    });

    describe("toString", () => {
      it("種別値を文字列で返す", () => {
        const small = ReviewType.reconstruct("small");
        const large = ReviewType.reconstruct("large");

        expect(small.toString()).toBe("small");
        expect(large.toString()).toBe("large");
      });
    });
  });

  describe("異常系", () => {
    describe("create", () => {
      it("無効な種別値でエラーをスローする", () => {
        expect(() => ReviewType.create("invalid")).toThrow();
      });

      it("空文字でエラーをスローする", () => {
        expect(() => ReviewType.create("")).toThrow();
      });
    });

    describe("reconstruct", () => {
      it("無効な種別値でエラーをスローする", () => {
        expect(() => ReviewType.reconstruct("invalid")).toThrow();
      });

      it("空文字でエラーをスローする", () => {
        expect(() => ReviewType.reconstruct("")).toThrow();
      });
    });
  });
});
