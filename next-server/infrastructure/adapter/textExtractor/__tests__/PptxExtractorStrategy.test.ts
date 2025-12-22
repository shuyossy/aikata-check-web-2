import { describe, it, expect, vi } from "vitest";
import { PptxExtractorStrategy } from "../strategies/PptxExtractorStrategy";
import officeParser from "officeparser";

// officeparserをモック
vi.mock("officeparser", () => ({
  default: {
    parseOfficeAsync: vi.fn(),
  },
}));

describe("PptxExtractorStrategy", () => {
  const strategy = new PptxExtractorStrategy();

  describe("getSupportedExtensions", () => {
    it(".pptxを返す", () => {
      expect(strategy.getSupportedExtensions()).toEqual([".pptx"]);
    });
  });

  describe("getStrategyType", () => {
    it("pptx-officeparserを返す", () => {
      expect(strategy.getStrategyType()).toBe("pptx-officeparser");
    });
  });

  describe("正常系", () => {
    it("PowerPoint文書からテキストを抽出する", async () => {
      const mockContent =
        "スライド1のタイトル\n\nスライド1の内容\n\nスライド2のタイトル";
      vi.mocked(officeParser.parseOfficeAsync).mockResolvedValueOnce(
        mockContent,
      );

      const buffer = Buffer.from("dummy pptx content");
      const result = await strategy.extract(buffer);

      expect(result.content).toBe(mockContent);
      expect(result.metadata.fileType).toBe("pptx");
      expect(result.metadata.strategyUsed).toBe("pptx-officeparser");
      expect(result.metadata.originalSize).toBe(buffer.length);
      expect(result.metadata.extractedLength).toBe(mockContent.length);
    });

    it("日本語を含むPowerPoint文書を正しく処理する", async () => {
      const mockContent = "プレゼンテーション\n\n・概要\n・詳細\n・まとめ";
      vi.mocked(officeParser.parseOfficeAsync).mockResolvedValueOnce(
        mockContent,
      );

      const buffer = Buffer.from("dummy pptx content");
      const result = await strategy.extract(buffer);

      expect(result.content).toBe(mockContent);
    });

    it("空のPowerPoint文書を処理する", async () => {
      vi.mocked(officeParser.parseOfficeAsync).mockResolvedValueOnce("");

      const buffer = Buffer.from("dummy pptx content");
      const result = await strategy.extract(buffer);

      expect(result.content).toBe("");
      expect(result.metadata.extractedLength).toBe(0);
    });

    it("複数スライドを含むPowerPoint文書を処理する", async () => {
      const mockContent =
        "スライド1\n表紙\n\nスライド2\n目次\n・項目1\n・項目2\n\nスライド3\n本文";
      vi.mocked(officeParser.parseOfficeAsync).mockResolvedValueOnce(
        mockContent,
      );

      const buffer = Buffer.from("dummy pptx content");
      const result = await strategy.extract(buffer);

      expect(result.content).toBe(mockContent);
      expect(result.content).toContain("スライド1");
      expect(result.content).toContain("スライド2");
      expect(result.content).toContain("スライド3");
    });

    it("箇条書きを含むPowerPoint文書を処理する", async () => {
      const mockContent =
        "チェックポイント\n\n・確認項目1\n・確認項目2\n・確認項目3";
      vi.mocked(officeParser.parseOfficeAsync).mockResolvedValueOnce(
        mockContent,
      );

      const buffer = Buffer.from("dummy pptx content");
      const result = await strategy.extract(buffer);

      expect(result.content).toContain("・確認項目1");
      expect(result.content).toContain("・確認項目2");
      expect(result.content).toContain("・確認項目3");
    });

    it("オプションなしでofficeparserを呼び出す", async () => {
      const mockContent = "テスト内容";
      vi.mocked(officeParser.parseOfficeAsync).mockResolvedValueOnce(
        mockContent,
      );

      const buffer = Buffer.from("dummy pptx content");
      await strategy.extract(buffer);

      expect(officeParser.parseOfficeAsync).toHaveBeenCalledWith(buffer);
    });
  });

  describe("異常系", () => {
    it("officeparserがエラーを投げた場合エラーを伝搬する", async () => {
      vi.mocked(officeParser.parseOfficeAsync).mockRejectedValueOnce(
        new Error("Invalid PPTX file"),
      );

      const buffer = Buffer.from("invalid content");

      await expect(strategy.extract(buffer)).rejects.toThrow(
        "Invalid PPTX file",
      );
    });
  });
});
