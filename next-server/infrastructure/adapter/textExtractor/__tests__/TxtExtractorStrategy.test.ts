import { describe, it, expect } from "vitest";
import { TxtExtractorStrategy } from "../strategies/TxtExtractorStrategy";

describe("TxtExtractorStrategy", () => {
  const strategy = new TxtExtractorStrategy();

  describe("getSupportedExtensions", () => {
    it(".txtを返す", () => {
      expect(strategy.getSupportedExtensions()).toEqual([".txt"]);
    });
  });

  describe("getStrategyType", () => {
    it("txt-defaultを返す", () => {
      expect(strategy.getStrategyType()).toBe("txt-default");
    });
  });

  describe("extract", () => {
    it("テキストファイルの内容をそのまま返す", async () => {
      const content = "項目1\n項目2\n項目3";
      const buffer = Buffer.from(content, "utf-8");

      const result = await strategy.extract(buffer);

      expect(result.content).toBe(content);
      expect(result.metadata.fileType).toBe("txt");
      expect(result.metadata.strategyUsed).toBe("txt-default");
      expect(result.metadata.originalSize).toBe(buffer.length);
      expect(result.metadata.extractedLength).toBe(content.length);
    });

    it("CRLF改行をそのまま保持する", async () => {
      const content = "項目1\r\n項目2\r\n項目3";
      const buffer = Buffer.from(content, "utf-8");

      const result = await strategy.extract(buffer);

      expect(result.content).toBe(content);
    });

    it("CR改行をそのまま保持する", async () => {
      const content = "項目1\r項目2\r項目3";
      const buffer = Buffer.from(content, "utf-8");

      const result = await strategy.extract(buffer);

      expect(result.content).toBe(content);
    });

    it("空行を含むテキストをそのまま返す", async () => {
      const content = "項目1\n\n項目2\n\n項目3";
      const buffer = Buffer.from(content, "utf-8");

      const result = await strategy.extract(buffer);

      expect(result.content).toBe(content);
    });

    it("空白を含む行をそのまま返す", async () => {
      const content = "  項目1  \n  項目2  ";
      const buffer = Buffer.from(content, "utf-8");

      const result = await strategy.extract(buffer);

      expect(result.content).toBe(content);
    });

    it("空のファイルを処理する", async () => {
      const content = "";
      const buffer = Buffer.from(content, "utf-8");

      const result = await strategy.extract(buffer);

      expect(result.content).toBe("");
      expect(result.metadata.extractedLength).toBe(0);
    });

    it("日本語を正しく処理する", async () => {
      const content = "チェック項目1\nチェック項目2\n確認事項";
      const buffer = Buffer.from(content, "utf-8");

      const result = await strategy.extract(buffer);

      expect(result.content).toBe(content);
    });

    it("特殊文字を含むテキストを処理する", async () => {
      const content = '項目（括弧）\n項目"クォート"\n項目,カンマ';
      const buffer = Buffer.from(content, "utf-8");

      const result = await strategy.extract(buffer);

      expect(result.content).toBe(content);
    });

    it("指定されたエンコーディングでデコードする", async () => {
      const content = "テスト";
      const buffer = Buffer.from(content, "utf-8");

      const result = await strategy.extract(buffer, { encoding: "utf-8" });

      expect(result.content).toBe(content);
    });
  });
});
