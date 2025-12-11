import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { FileTextExtractor } from "../FileTextExtractor";

/**
 * テスト用のExcelファイルバッファを作成するヘルパー関数
 */
function createTestExcelBuffer(
  sheets: { name: string; data: (string | number)[][] }[],
): Buffer {
  const workbook = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const worksheet = XLSX.utils.aoa_to_sheet(sheet.data);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
  }

  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}

describe("FileTextExtractor", () => {
  const extractor = new FileTextExtractor();

  describe("extract", () => {
    describe("txtファイル", () => {
      it("テキストファイルの内容を抽出する", async () => {
        const content = "項目1\n項目2\n項目3";
        const buffer = Buffer.from(content, "utf-8");

        const result = await extractor.extract(buffer, "test.txt");

        expect(result).toContain("項目1");
        expect(result).toContain("項目2");
        expect(result).toContain("項目3");
      });

      it("大文字拡張子も処理する", async () => {
        const content = "項目1\n項目2";
        const buffer = Buffer.from(content, "utf-8");

        const result = await extractor.extract(buffer, "test.TXT");

        expect(result).toContain("項目1");
        expect(result).toContain("項目2");
      });
    });

    describe("csvファイル", () => {
      it("CSVの内容を抽出する", async () => {
        const content = "項目1,値1\n項目2,値2";
        const buffer = Buffer.from(content, "utf-8");

        const result = await extractor.extract(buffer, "test.csv");

        expect(result).toContain("項目1,値1");
        expect(result).toContain("項目2,値2");
      });

      it("セル内改行を含むCSVを処理する", async () => {
        const content = `"項目1
改行あり",値1\n項目2,値2`;
        const buffer = Buffer.from(content, "utf-8");

        const result = await extractor.extract(buffer, "test.csv");

        expect(result).toContain("項目1");
        expect(result).toContain("改行あり");
        expect(result).toContain("項目2");
      });
    });

    describe("xlsxファイル", () => {
      it("Excelの内容をCSV形式で抽出する", async () => {
        const buffer = createTestExcelBuffer([
          {
            name: "Sheet1",
            data: [["項目1"], ["項目2"], ["項目3"]],
          },
        ]);

        const result = await extractor.extract(buffer, "test.xlsx");

        expect(result).toContain("#sheet:Sheet1");
        expect(result).toContain("項目1");
        expect(result).toContain("項目2");
        expect(result).toContain("項目3");
      });

      it("複数シートを抽出する", async () => {
        const buffer = createTestExcelBuffer([
          {
            name: "Sheet1",
            data: [["項目1"], ["項目2"]],
          },
          {
            name: "Sheet2",
            data: [["項目3"], ["項目4"]],
          },
        ]);

        const result = await extractor.extract(buffer, "test.xlsx");

        expect(result).toContain("#sheet:Sheet1");
        expect(result).toContain("#sheet:Sheet2");
        expect(result).toContain("項目1");
        expect(result).toContain("項目2");
        expect(result).toContain("項目3");
        expect(result).toContain("項目4");
      });

      it(".xlsファイルも処理する", async () => {
        const buffer = createTestExcelBuffer([
          {
            name: "Sheet1",
            data: [["項目1"], ["項目2"]],
          },
        ]);

        const result = await extractor.extract(buffer, "test.xls");

        expect(result).toContain("項目1");
        expect(result).toContain("項目2");
      });
    });

    describe("オプション", () => {
      it("正規化を無効にできる", async () => {
        const content = "項目1   \n項目2   ";
        const buffer = Buffer.from(content, "utf-8");

        const result = await extractor.extract(buffer, "test.txt", {
          normalize: false,
        });

        // 正規化無効時は末尾空白が残る
        expect(result).toBe(content);
      });

      it("正規化オプションを指定できる", async () => {
        const content = "項目1,\n項目2,";
        const buffer = Buffer.from(content, "utf-8");

        const result = await extractor.extract(buffer, "test.txt", {
          normalize: true,
          normalizerOptions: {
            removeTrailingCommas: false,
          },
        });

        // removeTrailingCommas: false なので末尾カンマが残る
        expect(result).toContain("項目1,");
        expect(result).toContain("項目2,");
      });
    });

    describe("正規化", () => {
      it("連続空白を圧縮する", async () => {
        const content = "項目1    文字列\n項目2    文字列";
        const buffer = Buffer.from(content, "utf-8");

        const result = await extractor.extract(buffer, "test.txt");

        expect(result).toContain("項目1 文字列");
        expect(result).toContain("項目2 文字列");
      });

      it("制御文字を除去する", async () => {
        const content = "項目1\u0000\n項目2";
        const buffer = Buffer.from(content, "utf-8");

        const result = await extractor.extract(buffer, "test.txt");

        expect(result).toContain("項目1");
        expect(result).toContain("項目2");
        expect(result).not.toContain("\u0000");
      });
    });

    describe("エラーケース", () => {
      it("サポートされていない拡張子でエラーを投げる", async () => {
        const buffer = Buffer.from("content", "utf-8");

        await expect(
          extractor.extract(buffer, "test.pdf"),
        ).rejects.toThrow("サポートされていないファイル形式です: .pdf");
      });

      it("拡張子のないファイルでエラーを投げる", async () => {
        const buffer = Buffer.from("content", "utf-8");

        await expect(extractor.extract(buffer, "test")).rejects.toThrow(
          "サポートされていないファイル形式です:",
        );
      });
    });
  });

  describe("getAvailableStrategies", () => {
    it(".txtの利用可能な戦略を返す", () => {
      const strategies = extractor.getAvailableStrategies(".txt");
      expect(strategies).toContain("txt-default");
    });

    it(".csvの利用可能な戦略を返す", () => {
      const strategies = extractor.getAvailableStrategies(".csv");
      expect(strategies).toContain("csv-default");
    });

    it(".xlsxの利用可能な戦略を返す", () => {
      const strategies = extractor.getAvailableStrategies(".xlsx");
      expect(strategies).toContain("xlsx-sheetjs");
    });

    it("サポートされていない拡張子は空配列を返す", () => {
      const strategies = extractor.getAvailableStrategies(".pdf");
      expect(strategies).toEqual([]);
    });
  });

  describe("isSupported", () => {
    it(".txtをサポートしている", () => {
      expect(extractor.isSupported(".txt")).toBe(true);
    });

    it(".csvをサポートしている", () => {
      expect(extractor.isSupported(".csv")).toBe(true);
    });

    it(".xlsxをサポートしている", () => {
      expect(extractor.isSupported(".xlsx")).toBe(true);
    });

    it(".xlsをサポートしている", () => {
      expect(extractor.isSupported(".xls")).toBe(true);
    });

    it("大文字拡張子も認識する", () => {
      expect(extractor.isSupported(".TXT")).toBe(true);
      expect(extractor.isSupported(".CSV")).toBe(true);
      expect(extractor.isSupported(".XLSX")).toBe(true);
    });

    it(".pdfはサポートしていない", () => {
      expect(extractor.isSupported(".pdf")).toBe(false);
    });

    it(".docxはサポートしていない", () => {
      expect(extractor.isSupported(".docx")).toBe(false);
    });
  });
});
