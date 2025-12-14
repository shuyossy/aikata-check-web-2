import { describe, it, expect } from "vitest";
import {
  splitChecklistEqually,
  splitChecklistIntoChunks,
} from "../checklistSplitter";

describe("checklistSplitter", () => {
  describe("splitChecklistEqually", () => {
    describe("正常系", () => {
      it("10件のアイテムを3件ずつに分割できる", () => {
        const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const result = splitChecklistEqually(items, 3);

        expect(result.length).toBe(4);
        // 等分割: 10 / 4 = 2.5 → 先頭2チャンクは3件、残り2チャンクは2件
        expect(result[0].length).toBe(3);
        expect(result[1].length).toBe(3);
        expect(result[2].length).toBe(2);
        expect(result[3].length).toBe(2);
        // 全アイテムが含まれている
        expect(result.flat()).toEqual(items);
      });

      it("6件のアイテムを2件ずつに分割できる", () => {
        const items = ["a", "b", "c", "d", "e", "f"];
        const result = splitChecklistEqually(items, 2);

        expect(result.length).toBe(3);
        expect(result).toEqual([
          ["a", "b"],
          ["c", "d"],
          ["e", "f"],
        ]);
      });

      it("アイテム数がmaxSize以下の場合は1チャンク", () => {
        const items = [1, 2, 3];
        const result = splitChecklistEqually(items, 5);

        expect(result.length).toBe(1);
        expect(result[0]).toEqual([1, 2, 3]);
      });

      it("アイテム数とmaxSizeが同じ場合は1チャンク", () => {
        const items = [1, 2, 3];
        const result = splitChecklistEqually(items, 3);

        expect(result.length).toBe(1);
        expect(result[0]).toEqual([1, 2, 3]);
      });

      it("maxSizeが1の場合は1件ずつ分割", () => {
        const items = [1, 2, 3];
        const result = splitChecklistEqually(items, 1);

        expect(result.length).toBe(3);
        expect(result).toEqual([[1], [2], [3]]);
      });

      it("空配列の場合は空配列を返す", () => {
        const result = splitChecklistEqually([], 3);

        expect(result).toEqual([]);
      });

      it("オブジェクト配列も分割できる", () => {
        const items = [
          { id: "1", content: "項目1" },
          { id: "2", content: "項目2" },
          { id: "3", content: "項目3" },
        ];
        const result = splitChecklistEqually(items, 2);

        expect(result.length).toBe(2);
        expect(result[0]).toEqual([
          { id: "1", content: "項目1" },
          { id: "2", content: "項目2" },
        ]);
        expect(result[1]).toEqual([{ id: "3", content: "項目3" }]);
      });
    });

    describe("異常系", () => {
      it("maxSizeが0の場合はエラー", () => {
        expect(() => splitChecklistEqually([1, 2, 3], 0)).toThrow(
          "maxSize must be at least 1",
        );
      });

      it("maxSizeが負の場合はエラー", () => {
        expect(() => splitChecklistEqually([1, 2, 3], -1)).toThrow(
          "maxSize must be at least 1",
        );
      });
    });
  });

  describe("splitChecklistIntoChunks", () => {
    describe("正常系", () => {
      it("チャンク情報を付与して分割できる", () => {
        const items = [1, 2, 3, 4, 5];
        const result = splitChecklistIntoChunks(items, 2);

        expect(result.length).toBe(3);
        expect(result[0]).toEqual({ chunkIndex: 0, items: [1, 2] });
        expect(result[1]).toEqual({ chunkIndex: 1, items: [3, 4] });
        expect(result[2]).toEqual({ chunkIndex: 2, items: [5] });
      });

      it("空配列の場合は空配列を返す", () => {
        const result = splitChecklistIntoChunks([], 3);

        expect(result).toEqual([]);
      });

      it("チェックリスト項目を分割できる", () => {
        const items = [
          { id: "a", content: "チェック項目A" },
          { id: "b", content: "チェック項目B" },
          { id: "c", content: "チェック項目C" },
        ];
        const result = splitChecklistIntoChunks(items, 2);

        expect(result.length).toBe(2);
        expect(result[0].chunkIndex).toBe(0);
        expect(result[0].items).toHaveLength(2);
        expect(result[1].chunkIndex).toBe(1);
        expect(result[1].items).toHaveLength(1);
      });
    });
  });
});
