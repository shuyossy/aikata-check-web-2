import { describe, it, expect } from "vitest";
import { CsvParser } from "../CsvParser";

describe("CsvParser", () => {
  describe("parse", () => {
    it("シンプルなCSVを解析できる", () => {
      const csvText = "項目1\n項目2\n項目3";
      const result = CsvParser.parse(csvText);
      expect(result).toEqual([["項目1"], ["項目2"], ["項目3"]]);
    });

    it("複数列のCSVを解析できる", () => {
      const csvText = "項目1,値1\n項目2,値2\n項目3,値3";
      const result = CsvParser.parse(csvText);
      expect(result).toEqual([
        ["項目1", "値1"],
        ["項目2", "値2"],
        ["項目3", "値3"],
      ]);
    });

    it("セル内改行を含むCSVを解析できる", () => {
      const csvText = `"項目1
改行あり",値1
項目2,値2`;
      const result = CsvParser.parse(csvText);
      expect(result).toEqual([
        ["項目1\n改行あり", "値1"],
        ["項目2", "値2"],
      ]);
    });

    it("クォートされたセルを正しく処理する", () => {
      const csvText = '"項目1","値1"\n"項目2","値2"';
      const result = CsvParser.parse(csvText);
      expect(result).toEqual([
        ["項目1", "値1"],
        ["項目2", "値2"],
      ]);
    });

    it('エスケープされたクォート("")を処理する', () => {
      const csvText = '"項目""1""",値1\n項目2,値2';
      const result = CsvParser.parse(csvText);
      expect(result).toEqual([
        ['項目"1"', "値1"],
        ["項目2", "値2"],
      ]);
    });

    it("CRLF改行を処理する", () => {
      const csvText = "項目1\r\n項目2\r\n項目3";
      const result = CsvParser.parse(csvText);
      expect(result).toEqual([["項目1"], ["項目2"], ["項目3"]]);
    });

    it("LF改行を処理する", () => {
      const csvText = "項目1\n項目2\n項目3";
      const result = CsvParser.parse(csvText);
      expect(result).toEqual([["項目1"], ["項目2"], ["項目3"]]);
    });

    it("空行をスキップする", () => {
      const csvText = "項目1\n\n項目2\n\n項目3";
      const result = CsvParser.parse(csvText);
      expect(result).toEqual([["項目1"], ["項目2"], ["項目3"]]);
    });

    it("シート名行(#sheet:で始まる行)をスキップする", () => {
      const csvText = "#sheet:Sheet1\n項目1\n項目2";
      const result = CsvParser.parse(csvText);
      expect(result).toEqual([["項目1"], ["項目2"]]);
    });

    it("複数シートのシート名行をスキップする", () => {
      const csvText = "#sheet:Sheet1\n項目1\n#sheet:Sheet2\n項目2";
      const result = CsvParser.parse(csvText);
      expect(result).toEqual([["項目1"], ["項目2"]]);
    });

    it("セル内にカンマを含むCSVを解析できる", () => {
      const csvText = '"項目1,カンマあり",値1\n項目2,値2';
      const result = CsvParser.parse(csvText);
      expect(result).toEqual([
        ["項目1,カンマあり", "値1"],
        ["項目2", "値2"],
      ]);
    });

    it("空のCSVは空配列を返す", () => {
      const csvText = "";
      const result = CsvParser.parse(csvText);
      expect(result).toEqual([]);
    });

    it("空白のみの行をスキップする", () => {
      const csvText = "項目1\n   \n項目2";
      const result = CsvParser.parse(csvText);
      expect(result).toEqual([["項目1"], ["項目2"]]);
    });
  });

  describe("validate", () => {
    it("正しいCSVに対してisValid: trueを返す", () => {
      const csvText = '"項目1"\n"項目2"';
      const result = CsvParser.validate(csvText);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("クォートが閉じられていないCSVに対してエラーを返す", () => {
      const csvText = '"項目1\n項目2';
      const result = CsvParser.validate(csvText);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("クォートが正しく閉じられていません");
    });

    it("エスケープされたクォートを含むCSVを正しく検証する", () => {
      const csvText = '"項目""1"""';
      const result = CsvParser.validate(csvText);
      expect(result.isValid).toBe(true);
    });

    it("クォートなしのCSVを正しく検証する", () => {
      const csvText = "項目1,値1\n項目2,値2";
      const result = CsvParser.validate(csvText);
      expect(result.isValid).toBe(true);
    });
  });

  describe("escapeField", () => {
    it("通常の文字列はそのまま返す", () => {
      expect(CsvParser.escapeField("項目1")).toBe("項目1");
    });

    it("カンマを含む文字列をクォートで囲む", () => {
      expect(CsvParser.escapeField("項目1,値1")).toBe('"項目1,値1"');
    });

    it("改行を含む文字列をクォートで囲む", () => {
      expect(CsvParser.escapeField("項目1\n改行")).toBe('"項目1\n改行"');
    });

    it("ダブルクォートをエスケープしてクォートで囲む", () => {
      expect(CsvParser.escapeField('項目"1"')).toBe('"項目""1"""');
    });

    it("nullをundefinedとして空文字を返す", () => {
      expect(CsvParser.escapeField(null as unknown as string)).toBe("");
    });
  });

  describe("stringify", () => {
    it("2次元配列をCSV文字列に変換する", () => {
      const rows = [
        ["項目1", "値1"],
        ["項目2", "値2"],
      ];
      const result = CsvParser.stringify(rows);
      expect(result).toBe("項目1,値1\n項目2,値2");
    });

    it("特殊文字を含むセルを適切にエスケープする", () => {
      const rows = [
        ["項目1,カンマ", "値1"],
        ["項目2\n改行", "値2"],
      ];
      const result = CsvParser.stringify(rows);
      expect(result).toBe('"項目1,カンマ",値1\n"項目2\n改行",値2');
    });
  });
});
