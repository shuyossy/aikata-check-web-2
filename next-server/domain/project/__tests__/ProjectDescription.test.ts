import { describe, it, expect } from "vitest";
import { ProjectDescription } from "../ProjectDescription";

describe("ProjectDescription", () => {
  describe("create", () => {
    it("有効な説明で作成できる", () => {
      const description = ProjectDescription.create("テストプロジェクトの説明");

      expect(description.value).toBe("テストプロジェクトの説明");
    });

    it("nullで作成できる", () => {
      const description = ProjectDescription.create(null);

      expect(description.value).toBeNull();
    });

    it("undefinedで作成できる", () => {
      const description = ProjectDescription.create(undefined);

      expect(description.value).toBeNull();
    });

    it("空文字列はnullに正規化される", () => {
      const description = ProjectDescription.create("");

      expect(description.value).toBeNull();
    });

    it("空白のみの文字列はnullに正規化される", () => {
      const description = ProjectDescription.create("   ");

      expect(description.value).toBeNull();
    });

    it("前後の空白がトリムされる", () => {
      const description = ProjectDescription.create("  説明文  ");

      expect(description.value).toBe("説明文");
    });

    it("最大文字数（1000文字）ちょうどの場合は作成できる", () => {
      const longText = "あ".repeat(1000);
      const description = ProjectDescription.create(longText);

      expect(description.value).toBe(longText);
      expect(description.value?.length).toBe(1000);
    });

    it("最大文字数（1000文字）を超える場合はエラー", () => {
      const longText = "あ".repeat(1001);

      expect(() => ProjectDescription.create(longText)).toThrow();
    });
  });

  describe("reconstruct", () => {
    it("既存の値から復元できる", () => {
      const description = ProjectDescription.reconstruct("復元された説明");

      expect(description.value).toBe("復元された説明");
    });

    it("nullから復元できる", () => {
      const description = ProjectDescription.reconstruct(null);

      expect(description.value).toBeNull();
    });

    it("バリデーションをスキップする（DBからの復元を想定）", () => {
      // 通常のcreateではエラーになる文字数でも復元できる
      const longText = "あ".repeat(1500);
      const description = ProjectDescription.reconstruct(longText);

      expect(description.value).toBe(longText);
    });
  });

  describe("hasValue", () => {
    it("値がある場合はtrueを返す", () => {
      const description = ProjectDescription.create("説明");

      expect(description.hasValue()).toBe(true);
    });

    it("値がnullの場合はfalseを返す", () => {
      const description = ProjectDescription.create(null);

      expect(description.hasValue()).toBe(false);
    });
  });

  describe("equals", () => {
    it("同じ値を持つ場合はtrueを返す", () => {
      const description1 = ProjectDescription.create("同じ説明");
      const description2 = ProjectDescription.create("同じ説明");

      expect(description1.equals(description2)).toBe(true);
    });

    it("異なる値を持つ場合はfalseを返す", () => {
      const description1 = ProjectDescription.create("説明1");
      const description2 = ProjectDescription.create("説明2");

      expect(description1.equals(description2)).toBe(false);
    });

    it("両方nullの場合はtrueを返す", () => {
      const description1 = ProjectDescription.create(null);
      const description2 = ProjectDescription.create(null);

      expect(description1.equals(description2)).toBe(true);
    });

    it("一方がnullの場合はfalseを返す", () => {
      const description1 = ProjectDescription.create("説明");
      const description2 = ProjectDescription.create(null);

      expect(description1.equals(description2)).toBe(false);
    });
  });

  describe("toString", () => {
    it("値を文字列として返す", () => {
      const description = ProjectDescription.create("文字列化テスト");

      expect(description.toString()).toBe("文字列化テスト");
    });

    it("nullの場合は空文字列を返す", () => {
      const description = ProjectDescription.create(null);

      expect(description.toString()).toBe("");
    });
  });
});
