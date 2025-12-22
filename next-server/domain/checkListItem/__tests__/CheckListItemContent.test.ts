import { describe, it, expect } from "vitest";
import { CheckListItemContent } from "../CheckListItemContent";

describe("CheckListItemContent", () => {
  describe("正常系", () => {
    describe("create", () => {
      it("有効な内容でチェック項目内容を生成できる", () => {
        const content = CheckListItemContent.create(
          "要件定義書との整合性が確保されているか",
        );

        expect(content.value).toBe("要件定義書との整合性が確保されているか");
      });

      it("長い文字列の内容も生成できる", () => {
        const longContent = "あ".repeat(5000);
        const content = CheckListItemContent.create(longContent);

        expect(content.value).toBe(longContent);
        expect(content.value.length).toBe(5000);
      });
    });

    describe("reconstruct", () => {
      it("既存の文字列から復元できる", () => {
        const contentString = "セキュリティ要件が考慮されているか";
        const content = CheckListItemContent.reconstruct(contentString);

        expect(content.value).toBe(contentString);
      });
    });

    describe("equals", () => {
      it("同じ値を持つCheckListItemContentは等しい", () => {
        const content1 = CheckListItemContent.create("チェック項目1");
        const content2 = CheckListItemContent.create("チェック項目1");

        expect(content1.equals(content2)).toBe(true);
      });

      it("異なる値を持つCheckListItemContentは等しくない", () => {
        const content1 = CheckListItemContent.create("チェック項目1");
        const content2 = CheckListItemContent.create("チェック項目2");

        expect(content1.equals(content2)).toBe(false);
      });
    });

    describe("toString", () => {
      it("内容文字列を返す", () => {
        const contentString = "パフォーマンス要件が満たされているか";
        const content = CheckListItemContent.create(contentString);

        expect(content.toString()).toBe(contentString);
      });
    });
  });

  describe("異常系", () => {
    describe("create", () => {
      it("空文字列の場合はエラーをスローする", () => {
        expect(() => CheckListItemContent.create("")).toThrow();
      });

      it("空白のみの場合はエラーをスローする", () => {
        expect(() => CheckListItemContent.create("   ")).toThrow();
      });

      it("nullish値の場合はエラーをスローする", () => {
        expect(() =>
          CheckListItemContent.create(null as unknown as string),
        ).toThrow();
        expect(() =>
          CheckListItemContent.create(undefined as unknown as string),
        ).toThrow();
      });
    });
  });
});
