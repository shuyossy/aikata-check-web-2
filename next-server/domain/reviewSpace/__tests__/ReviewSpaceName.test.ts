import { describe, it, expect } from "vitest";
import { ReviewSpaceName } from "../ReviewSpaceName";

describe("ReviewSpaceName", () => {
  describe("正常系", () => {
    describe("create", () => {
      it("有効なスペース名を生成できる", () => {
        const name = ReviewSpaceName.create("設計書レビュー");

        expect(name.value).toBe("設計書レビュー");
      });

      it("100文字ちょうどのスペース名は有効", () => {
        const validName = "あ".repeat(100);
        const name = ReviewSpaceName.create(validName);

        expect(name.value).toBe(validName);
      });

      it("前後の空白を含む名前も有効", () => {
        // 空白トリムせず保持する（既存のProjectNameと同じ仕様）
        const name = ReviewSpaceName.create(" スペース名 ");

        expect(name.value).toBe(" スペース名 ");
      });
    });

    describe("reconstruct", () => {
      it("既存の文字列から復元できる", () => {
        const name = ReviewSpaceName.reconstruct("復元スペース");

        expect(name.value).toBe("復元スペース");
      });
    });

    describe("equals", () => {
      it("同じ値を持つReviewSpaceNameは等しい", () => {
        const name1 = ReviewSpaceName.create("同じ名前");
        const name2 = ReviewSpaceName.create("同じ名前");

        expect(name1.equals(name2)).toBe(true);
      });

      it("異なる値を持つReviewSpaceNameは等しくない", () => {
        const name1 = ReviewSpaceName.create("名前1");
        const name2 = ReviewSpaceName.create("名前2");

        expect(name1.equals(name2)).toBe(false);
      });
    });

    describe("toString", () => {
      it("スペース名を返す", () => {
        const name = ReviewSpaceName.create("テストスペース");

        expect(name.toString()).toBe("テストスペース");
      });
    });
  });

  describe("異常系", () => {
    describe("create", () => {
      it("空文字列の場合はエラーをスローする", () => {
        expect(() => ReviewSpaceName.create("")).toThrow();
      });

      it("空白のみの場合はエラーをスローする", () => {
        expect(() => ReviewSpaceName.create("   ")).toThrow();
      });

      it("101文字以上の場合はエラーをスローする", () => {
        const tooLongName = "あ".repeat(101);

        expect(() => ReviewSpaceName.create(tooLongName)).toThrow();
      });

      it("nullish値の場合はエラーをスローする", () => {
        expect(() =>
          ReviewSpaceName.create(null as unknown as string),
        ).toThrow();
        expect(() =>
          ReviewSpaceName.create(undefined as unknown as string),
        ).toThrow();
      });
    });
  });
});
