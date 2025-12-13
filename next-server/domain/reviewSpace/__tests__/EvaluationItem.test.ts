import { describe, it, expect } from "vitest";
import { EvaluationItem } from "../EvaluationItem";

describe("EvaluationItem", () => {
  describe("正常系", () => {
    describe("create", () => {
      it("有効な評定項目を生成できる", () => {
        const item = EvaluationItem.create({
          label: "A",
          description: "基準を完全に満たしている",
        });

        expect(item.label).toBe("A");
        expect(item.description).toBe("基準を完全に満たしている");
      });

      it("10文字ちょうどのラベルは有効", () => {
        const validLabel = "あ".repeat(10);
        const item = EvaluationItem.create({
          label: validLabel,
          description: "説明",
        });

        expect(item.label).toBe(validLabel);
      });

      it("200文字ちょうどの説明は有効", () => {
        const validDescription = "あ".repeat(200);
        const item = EvaluationItem.create({
          label: "A",
          description: validDescription,
        });

        expect(item.description).toBe(validDescription);
      });

      it("特殊文字を含むラベルも有効", () => {
        const item = EvaluationItem.create({
          label: "-",
          description: "評価の対象外",
        });

        expect(item.label).toBe("-");
      });
    });

    describe("reconstruct", () => {
      it("既存データから復元できる", () => {
        const item = EvaluationItem.reconstruct({
          label: "B",
          description: "復元されたデータ",
        });

        expect(item.label).toBe("B");
        expect(item.description).toBe("復元されたデータ");
      });
    });

    describe("toJSON", () => {
      it("JSON形式に変換できる", () => {
        const item = EvaluationItem.create({
          label: "C",
          description: "テスト説明",
        });

        const json = item.toJSON();

        expect(json).toEqual({
          label: "C",
          description: "テスト説明",
        });
      });
    });

    describe("equals", () => {
      it("同じ値を持つEvaluationItemは等しい", () => {
        const item1 = EvaluationItem.create({
          label: "A",
          description: "同じ説明",
        });
        const item2 = EvaluationItem.create({
          label: "A",
          description: "同じ説明",
        });

        expect(item1.equals(item2)).toBe(true);
      });

      it("ラベルが異なる場合は等しくない", () => {
        const item1 = EvaluationItem.create({
          label: "A",
          description: "同じ説明",
        });
        const item2 = EvaluationItem.create({
          label: "B",
          description: "同じ説明",
        });

        expect(item1.equals(item2)).toBe(false);
      });

      it("説明が異なる場合は等しくない", () => {
        const item1 = EvaluationItem.create({
          label: "A",
          description: "説明1",
        });
        const item2 = EvaluationItem.create({
          label: "A",
          description: "説明2",
        });

        expect(item1.equals(item2)).toBe(false);
      });
    });
  });

  describe("異常系", () => {
    describe("create", () => {
      it("ラベルが空文字列の場合はエラーをスローする", () => {
        expect(() =>
          EvaluationItem.create({
            label: "",
            description: "説明",
          }),
        ).toThrow();
      });

      it("ラベルが空白のみの場合はエラーをスローする", () => {
        expect(() =>
          EvaluationItem.create({
            label: "   ",
            description: "説明",
          }),
        ).toThrow();
      });

      it("ラベルが11文字以上の場合はエラーをスローする", () => {
        const tooLongLabel = "あ".repeat(11);

        expect(() =>
          EvaluationItem.create({
            label: tooLongLabel,
            description: "説明",
          }),
        ).toThrow();
      });

      it("説明が空文字列の場合はエラーをスローする", () => {
        expect(() =>
          EvaluationItem.create({
            label: "A",
            description: "",
          }),
        ).toThrow();
      });

      it("説明が空白のみの場合はエラーをスローする", () => {
        expect(() =>
          EvaluationItem.create({
            label: "A",
            description: "   ",
          }),
        ).toThrow();
      });

      it("説明が201文字以上の場合はエラーをスローする", () => {
        const tooLongDescription = "あ".repeat(201);

        expect(() =>
          EvaluationItem.create({
            label: "A",
            description: tooLongDescription,
          }),
        ).toThrow();
      });

      it("nullishなラベルの場合はエラーをスローする", () => {
        expect(() =>
          EvaluationItem.create({
            label: null as unknown as string,
            description: "説明",
          }),
        ).toThrow();
        expect(() =>
          EvaluationItem.create({
            label: undefined as unknown as string,
            description: "説明",
          }),
        ).toThrow();
      });

      it("nullishな説明の場合はエラーをスローする", () => {
        expect(() =>
          EvaluationItem.create({
            label: "A",
            description: null as unknown as string,
          }),
        ).toThrow();
        expect(() =>
          EvaluationItem.create({
            label: "A",
            description: undefined as unknown as string,
          }),
        ).toThrow();
      });
    });
  });
});
