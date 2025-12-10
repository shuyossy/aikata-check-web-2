import { describe, it, expect } from "vitest";
import { ProjectName } from "../ProjectName";

describe("ProjectName", () => {
  describe("create", () => {
    it("有効なプロジェクト名を生成できる", () => {
      const name = ProjectName.create("テストプロジェクト");

      expect(name.value).toBe("テストプロジェクト");
    });

    it("100文字ちょうどのプロジェクト名は有効", () => {
      const validName = "あ".repeat(100);
      const name = ProjectName.create(validName);

      expect(name.value).toBe(validName);
    });

    it("空文字列の場合はエラーをスローする", () => {
      expect(() => ProjectName.create("")).toThrow();
    });

    it("空白のみの場合はエラーをスローする", () => {
      expect(() => ProjectName.create("   ")).toThrow();
    });

    it("101文字以上の場合はエラーをスローする", () => {
      const tooLongName = "あ".repeat(101);

      expect(() => ProjectName.create(tooLongName)).toThrow();
    });
  });

  describe("reconstruct", () => {
    it("既存の文字列から復元できる", () => {
      const name = ProjectName.reconstruct("復元プロジェクト");

      expect(name.value).toBe("復元プロジェクト");
    });
  });

  describe("equals", () => {
    it("同じ値を持つProjectNameは等しい", () => {
      const name1 = ProjectName.create("同じ名前");
      const name2 = ProjectName.create("同じ名前");

      expect(name1.equals(name2)).toBe(true);
    });

    it("異なる値を持つProjectNameは等しくない", () => {
      const name1 = ProjectName.create("名前1");
      const name2 = ProjectName.create("名前2");

      expect(name1.equals(name2)).toBe(false);
    });
  });

  describe("toString", () => {
    it("プロジェクト名を返す", () => {
      const name = ProjectName.create("テスト");

      expect(name.toString()).toBe("テスト");
    });
  });
});
