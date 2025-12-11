import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { XlsxSheetJsStrategy } from "../strategies/XlsxSheetJsStrategy";

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

describe("XlsxSheetJsStrategy", () => {
  const strategy = new XlsxSheetJsStrategy();

  describe("getSupportedExtensions", () => {
    it(".xlsxと.xlsを返す", () => {
      expect(strategy.getSupportedExtensions()).toEqual([".xlsx", ".xls"]);
    });
  });

  describe("getStrategyType", () => {
    it("xlsx-sheetjsを返す", () => {
      expect(strategy.getStrategyType()).toBe("xlsx-sheetjs");
    });
  });

  describe("extract", () => {
    it("ExcelをCSV形式のテキストとして抽出する", async () => {
      const buffer = createTestExcelBuffer([
        {
          name: "Sheet1",
          data: [["項目1"], ["項目2"], ["項目3"]],
        },
      ]);

      const result = await strategy.extract(buffer);

      expect(result.content).toContain("#sheet:Sheet1");
      expect(result.content).toContain("項目1");
      expect(result.content).toContain("項目2");
      expect(result.content).toContain("項目3");
      expect(result.metadata.fileType).toBe("xlsx");
      expect(result.metadata.strategyUsed).toBe("xlsx-sheetjs");
    });

    it("複数列Excelを正しく抽出する", async () => {
      const buffer = createTestExcelBuffer([
        {
          name: "Sheet1",
          data: [
            ["項目1", "値1"],
            ["項目2", "値2"],
            ["項目3", "値3"],
          ],
        },
      ]);

      const result = await strategy.extract(buffer);

      expect(result.content).toContain("#sheet:Sheet1");
      expect(result.content).toContain("項目1,値1");
      expect(result.content).toContain("項目2,値2");
      expect(result.content).toContain("項目3,値3");
    });

    it("複数シートをそれぞれシート区切りマーカー付きで抽出する", async () => {
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

      const result = await strategy.extract(buffer);

      expect(result.content).toContain("#sheet:Sheet1");
      expect(result.content).toContain("#sheet:Sheet2");
      expect(result.content).toContain("項目1");
      expect(result.content).toContain("項目2");
      expect(result.content).toContain("項目3");
      expect(result.content).toContain("項目4");
    });

    it("空行を含むシートを正しく抽出する", async () => {
      const buffer = createTestExcelBuffer([
        {
          name: "Sheet1",
          data: [["項目1"], [""], ["項目2"], [""], ["項目3"]],
        },
      ]);

      const result = await strategy.extract(buffer);

      // 空行も含まれる（blankrows: true）
      expect(result.content).toContain("#sheet:Sheet1");
      expect(result.content).toContain("項目1");
      expect(result.content).toContain("項目2");
      expect(result.content).toContain("項目3");
    });

    it("数値セルを含むシートを正しく抽出する", async () => {
      const buffer = createTestExcelBuffer([
        {
          name: "Sheet1",
          data: [[123], [456], [789]],
        },
      ]);

      const result = await strategy.extract(buffer);

      expect(result.content).toContain("123");
      expect(result.content).toContain("456");
      expect(result.content).toContain("789");
    });

    it("空のExcelを処理する", async () => {
      const buffer = createTestExcelBuffer([
        {
          name: "Sheet1",
          data: [],
        },
      ]);

      const result = await strategy.extract(buffer);

      expect(result.content).toContain("#sheet:Sheet1");
      expect(result.metadata.extractedLength).toBeGreaterThan(0);
    });

    it("メタデータを正しく設定する", async () => {
      const buffer = createTestExcelBuffer([
        {
          name: "Sheet1",
          data: [["項目1"], ["項目2"]],
        },
      ]);

      const result = await strategy.extract(buffer);

      expect(result.metadata.originalSize).toBe(buffer.length);
      expect(result.metadata.extractedLength).toBeGreaterThan(0);
    });

    it("日本語を正しく処理する", async () => {
      const buffer = createTestExcelBuffer([
        {
          name: "シート1",
          data: [["チェック項目1"], ["チェック項目2"], ["確認事項"]],
        },
      ]);

      const result = await strategy.extract(buffer);

      expect(result.content).toContain("#sheet:シート1");
      expect(result.content).toContain("チェック項目1");
      expect(result.content).toContain("チェック項目2");
      expect(result.content).toContain("確認事項");
    });

    it("特殊文字を含むセルを処理する", async () => {
      const buffer = createTestExcelBuffer([
        {
          name: "Sheet1",
          data: [["項目（括弧）"], ["項目,カンマ"]],
        },
      ]);

      const result = await strategy.extract(buffer);

      expect(result.content).toContain("項目（括弧）");
      // カンマを含むセルはクォートされる
      expect(result.content).toContain("カンマ");
    });

    it("シート区切りマーカーの形式が正しい", async () => {
      const buffer = createTestExcelBuffer([
        {
          name: "TestSheet",
          data: [["項目1"]],
        },
      ]);

      const result = await strategy.extract(buffer);

      // #sheet:シート名 の形式で区切られている
      expect(result.content).toMatch(/^#sheet:TestSheet/m);
    });
  });
});
