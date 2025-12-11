import { describe, it, expect } from "vitest";
import { ReviewSpaceDescription } from "../ReviewSpaceDescription";

describe("ReviewSpaceDescription", () => {
  describe("正常系", () => {
    describe("create", () => {
      it("有効なスペース説明を生成できる", () => {
        const description = ReviewSpaceDescription.create(
          "システム設計書のレビューを実施します",
        );

        expect(description.value).toBe("システム設計書のレビューを実施します");
      });

      it("1000文字ちょうどの説明は有効", () => {
        const validDescription = "あ".repeat(1000);
        const description = ReviewSpaceDescription.create(validDescription);

        expect(description.value).toBe(validDescription);
      });

      it("空文字列の場合はnullになる", () => {
        const description = ReviewSpaceDescription.create("");

        expect(description.value).toBeNull();
      });

      it("空白のみの場合はnullになる", () => {
        const description = ReviewSpaceDescription.create("   ");

        expect(description.value).toBeNull();
      });

      it("nullの場合はnullになる", () => {
        const description = ReviewSpaceDescription.create(null);

        expect(description.value).toBeNull();
      });

      it("undefinedの場合はnullになる", () => {
        const description = ReviewSpaceDescription.create(undefined);

        expect(description.value).toBeNull();
      });

      it("前後の空白はトリムされる", () => {
        const description = ReviewSpaceDescription.create("  説明文  ");

        expect(description.value).toBe("説明文");
      });
    });

    describe("reconstruct", () => {
      it("既存の文字列から復元できる", () => {
        const description = ReviewSpaceDescription.reconstruct("復元説明");

        expect(description.value).toBe("復元説明");
      });

      it("nullから復元できる", () => {
        const description = ReviewSpaceDescription.reconstruct(null);

        expect(description.value).toBeNull();
      });
    });

    describe("hasValue", () => {
      it("値がある場合はtrueを返す", () => {
        const description = ReviewSpaceDescription.create("説明あり");

        expect(description.hasValue()).toBe(true);
      });

      it("値がない場合はfalseを返す", () => {
        const description = ReviewSpaceDescription.create(null);

        expect(description.hasValue()).toBe(false);
      });
    });

    describe("equals", () => {
      it("同じ値を持つReviewSpaceDescriptionは等しい", () => {
        const desc1 = ReviewSpaceDescription.create("同じ説明");
        const desc2 = ReviewSpaceDescription.create("同じ説明");

        expect(desc1.equals(desc2)).toBe(true);
      });

      it("両方nullの場合は等しい", () => {
        const desc1 = ReviewSpaceDescription.create(null);
        const desc2 = ReviewSpaceDescription.create(null);

        expect(desc1.equals(desc2)).toBe(true);
      });

      it("異なる値を持つReviewSpaceDescriptionは等しくない", () => {
        const desc1 = ReviewSpaceDescription.create("説明1");
        const desc2 = ReviewSpaceDescription.create("説明2");

        expect(desc1.equals(desc2)).toBe(false);
      });
    });

    describe("toString", () => {
      it("説明文を返す", () => {
        const description = ReviewSpaceDescription.create("テスト説明");

        expect(description.toString()).toBe("テスト説明");
      });

      it("nullの場合は空文字列を返す", () => {
        const description = ReviewSpaceDescription.create(null);

        expect(description.toString()).toBe("");
      });
    });
  });

  describe("異常系", () => {
    describe("create", () => {
      it("1001文字以上の場合はエラーをスローする", () => {
        const tooLongDescription = "あ".repeat(1001);

        expect(() => ReviewSpaceDescription.create(tooLongDescription)).toThrow();
      });
    });
  });
});
