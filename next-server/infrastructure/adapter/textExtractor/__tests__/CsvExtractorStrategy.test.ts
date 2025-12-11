import { describe, it, expect } from "vitest";
import { CsvExtractorStrategy } from "../strategies/CsvExtractorStrategy";

describe("CsvExtractorStrategy", () => {
  const strategy = new CsvExtractorStrategy();

  describe("getSupportedExtensions", () => {
    it(".csvを返す", () => {
      expect(strategy.getSupportedExtensions()).toEqual([".csv"]);
    });
  });

  describe("getStrategyType", () => {
    it("csv-defaultを返す", () => {
      expect(strategy.getStrategyType()).toBe("csv-default");
    });
  });

  describe("extract", () => {
    it("CSVテキストをそのまま返す", async () => {
      const content = "項目1\n項目2\n項目3";
      const buffer = Buffer.from(content, "utf-8");

      const result = await strategy.extract(buffer);

      expect(result.content).toBe(content);
      expect(result.metadata.fileType).toBe("csv");
      expect(result.metadata.strategyUsed).toBe("csv-default");
      expect(result.metadata.originalSize).toBe(buffer.length);
      expect(result.metadata.extractedLength).toBe(content.length);
    });

    it("複数列CSVをそのまま返す", async () => {
      const content = "項目1,値1\n項目2,値2\n項目3,値3";
      const buffer = Buffer.from(content, "utf-8");

      const result = await strategy.extract(buffer);

      expect(result.content).toBe(content);
    });

    it("セル内改行を含むCSVをそのまま返す", async () => {
      const content = `"項目1
改行あり"\n項目2\n項目3`;
      const buffer = Buffer.from(content, "utf-8");

      const result = await strategy.extract(buffer);

      expect(result.content).toBe(content);
    });

    it("クォートされたセルを含むCSVをそのまま返す", async () => {
      const content = '"項目1","値1"\n"項目2","値2"';
      const buffer = Buffer.from(content, "utf-8");

      const result = await strategy.extract(buffer);

      expect(result.content).toBe(content);
    });

    it("エスケープされたクォートを含むCSVをそのまま返す", async () => {
      const content = '"項目""1"""\n項目2';
      const buffer = Buffer.from(content, "utf-8");

      const result = await strategy.extract(buffer);

      expect(result.content).toBe(content);
    });

    it("カンマを含むセルを処理する", async () => {
      const content = '"項目1,カンマあり"\n項目2';
      const buffer = Buffer.from(content, "utf-8");

      const result = await strategy.extract(buffer);

      expect(result.content).toBe(content);
    });

    it("空行を含むCSVをそのまま返す", async () => {
      const content = "項目1\n\n項目2\n\n項目3";
      const buffer = Buffer.from(content, "utf-8");

      const result = await strategy.extract(buffer);

      expect(result.content).toBe(content);
    });

    it("空のCSVを処理する", async () => {
      const content = "";
      const buffer = Buffer.from(content, "utf-8");

      const result = await strategy.extract(buffer);

      expect(result.content).toBe("");
      expect(result.metadata.extractedLength).toBe(0);
    });

    it("CRLF改行を含むCSVをそのまま返す", async () => {
      const content = "項目1\r\n項目2\r\n項目3";
      const buffer = Buffer.from(content, "utf-8");

      const result = await strategy.extract(buffer);

      expect(result.content).toBe(content);
    });

    it("クォートが閉じられていないCSVでエラーを投げる", async () => {
      const content = '"項目1\n項目2';
      const buffer = Buffer.from(content, "utf-8");

      await expect(strategy.extract(buffer)).rejects.toThrow(
        "クォートが正しく閉じられていません",
      );
    });

    it("日本語を正しく処理する", async () => {
      const content = "チェック項目,確認事項\n項目1,値1";
      const buffer = Buffer.from(content, "utf-8");

      const result = await strategy.extract(buffer);

      expect(result.content).toBe(content);
    });

    it("メタデータを正しく設定する", async () => {
      const content = "項目1\n項目2\n項目3";
      const buffer = Buffer.from(content, "utf-8");

      const result = await strategy.extract(buffer);

      expect(result.metadata.originalSize).toBe(buffer.length);
      expect(result.metadata.extractedLength).toBe(content.length);
    });
  });
});
