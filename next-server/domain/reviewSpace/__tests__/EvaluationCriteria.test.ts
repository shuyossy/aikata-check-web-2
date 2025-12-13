import { describe, it, expect } from "vitest";
import { EvaluationCriteria } from "../EvaluationCriteria";
import { EvaluationItemProps } from "../EvaluationItem";

describe("EvaluationCriteria", () => {
  // テスト用の有効な評定項目
  const validItems: EvaluationItemProps[] = [
    { label: "A", description: "基準を完全に満たしている" },
    { label: "B", description: "基準をある程度満たしている" },
    { label: "C", description: "基準を満たしていない" },
  ];

  describe("正常系", () => {
    describe("create", () => {
      it("有効な評定基準を生成できる", () => {
        const criteria = EvaluationCriteria.create(validItems);

        expect(criteria.items.length).toBe(3);
        expect(criteria.items[0].label).toBe("A");
        expect(criteria.items[1].label).toBe("B");
        expect(criteria.items[2].label).toBe("C");
      });

      it("1項目のみでも有効", () => {
        const singleItem = [{ label: "A", description: "唯一の評定" }];
        const criteria = EvaluationCriteria.create(singleItem);

        expect(criteria.items.length).toBe(1);
      });

      it("10項目ちょうどは有効", () => {
        const tenItems = Array.from({ length: 10 }, (_, i) => ({
          label: String(i),
          description: `評定${i}`,
        }));
        const criteria = EvaluationCriteria.create(tenItems);

        expect(criteria.items.length).toBe(10);
      });
    });

    describe("createDefault", () => {
      it("デフォルトの評定基準を生成できる", () => {
        const criteria = EvaluationCriteria.createDefault();

        expect(criteria.items.length).toBe(4);
        expect(criteria.items[0].label).toBe("A");
        expect(criteria.items[0].description).toBe("基準を完全に満たしている");
        expect(criteria.items[1].label).toBe("B");
        expect(criteria.items[1].description).toBe("基準をある程度満たしている");
        expect(criteria.items[2].label).toBe("C");
        expect(criteria.items[2].description).toBe("基準を満たしていない");
        expect(criteria.items[3].label).toBe("-");
        expect(criteria.items[3].description).toBe("評価の対象外、または評価できない");
      });
    });

    describe("reconstruct", () => {
      it("既存データから復元できる", () => {
        const criteria = EvaluationCriteria.reconstruct(validItems);

        expect(criteria.items.length).toBe(3);
      });
    });

    describe("toJSON", () => {
      it("JSON形式に変換できる", () => {
        const criteria = EvaluationCriteria.create(validItems);
        const json = criteria.toJSON();

        expect(json).toEqual(validItems);
      });
    });

    describe("fromJSON", () => {
      it("JSONから復元できる", () => {
        const criteria = EvaluationCriteria.fromJSON(validItems);

        expect(criteria.items.length).toBe(3);
        expect(criteria.items[0].label).toBe("A");
      });
    });

    describe("equals", () => {
      it("同じ項目を持つEvaluationCriteriaは等しい", () => {
        const criteria1 = EvaluationCriteria.create(validItems);
        const criteria2 = EvaluationCriteria.create(validItems);

        expect(criteria1.equals(criteria2)).toBe(true);
      });

      it("項目数が異なる場合は等しくない", () => {
        const criteria1 = EvaluationCriteria.create(validItems);
        const criteria2 = EvaluationCriteria.create([validItems[0]]);

        expect(criteria1.equals(criteria2)).toBe(false);
      });

      it("項目の内容が異なる場合は等しくない", () => {
        const criteria1 = EvaluationCriteria.create(validItems);
        const criteria2 = EvaluationCriteria.create([
          { label: "X", description: "異なる説明" },
          validItems[1],
          validItems[2],
        ]);

        expect(criteria1.equals(criteria2)).toBe(false);
      });
    });
  });

  describe("異常系", () => {
    describe("create", () => {
      it("空の配列の場合はエラーをスローする", () => {
        expect(() => EvaluationCriteria.create([])).toThrow();
      });

      it("11項目以上の場合はエラーをスローする", () => {
        const elevenItems = Array.from({ length: 11 }, (_, i) => ({
          label: String(i),
          description: `評定${i}`,
        }));

        expect(() => EvaluationCriteria.create(elevenItems)).toThrow();
      });

      it("ラベルが重複している場合はエラーをスローする", () => {
        const duplicateItems = [
          { label: "A", description: "説明1" },
          { label: "A", description: "説明2" },
        ];

        expect(() => EvaluationCriteria.create(duplicateItems)).toThrow();
      });

      it("nullishな配列の場合はエラーをスローする", () => {
        expect(() =>
          EvaluationCriteria.create(null as unknown as EvaluationItemProps[]),
        ).toThrow();
        expect(() =>
          EvaluationCriteria.create(undefined as unknown as EvaluationItemProps[]),
        ).toThrow();
      });

      it("無効な評定項目が含まれている場合はエラーをスローする", () => {
        const invalidItems = [
          { label: "", description: "空のラベル" },
          { label: "B", description: "有効" },
        ];

        expect(() => EvaluationCriteria.create(invalidItems)).toThrow();
      });
    });
  });
});
