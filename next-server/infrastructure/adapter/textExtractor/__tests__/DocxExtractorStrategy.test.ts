import { describe, it, expect, vi } from "vitest";
import { DocxExtractorStrategy } from "../strategies/DocxExtractorStrategy";
import mammoth from "mammoth";

// mammothをモック
vi.mock("mammoth", () => ({
  default: {
    extractRawText: vi.fn(),
  },
}));

describe("DocxExtractorStrategy", () => {
  const strategy = new DocxExtractorStrategy();

  describe("getSupportedExtensions", () => {
    it(".docxを返す", () => {
      expect(strategy.getSupportedExtensions()).toEqual([".docx"]);
    });
  });

  describe("getStrategyType", () => {
    it("docx-mammothを返す", () => {
      expect(strategy.getStrategyType()).toBe("docx-mammoth");
    });
  });

  describe("正常系", () => {
    it("Word文書からテキストを抽出する", async () => {
      const mockContent = "ドキュメントの内容\n\n段落1\n段落2";
      vi.mocked(mammoth.extractRawText).mockResolvedValueOnce({
        value: mockContent,
        messages: [],
      });

      const buffer = Buffer.from("dummy docx content");
      const result = await strategy.extract(buffer);

      expect(result.content).toBe(mockContent);
      expect(result.metadata.fileType).toBe("docx");
      expect(result.metadata.strategyUsed).toBe("docx-mammoth");
      expect(result.metadata.originalSize).toBe(buffer.length);
      expect(result.metadata.extractedLength).toBe(mockContent.length);
    });

    it("日本語を含むWord文書を正しく処理する", async () => {
      const mockContent =
        "チェックリスト\n\n項目1：確認事項\n項目2：レビュー観点";
      vi.mocked(mammoth.extractRawText).mockResolvedValueOnce({
        value: mockContent,
        messages: [],
      });

      const buffer = Buffer.from("dummy docx content");
      const result = await strategy.extract(buffer);

      expect(result.content).toBe(mockContent);
    });

    it("空のWord文書を処理する", async () => {
      vi.mocked(mammoth.extractRawText).mockResolvedValueOnce({
        value: "",
        messages: [],
      });

      const buffer = Buffer.from("dummy docx content");
      const result = await strategy.extract(buffer);

      expect(result.content).toBe("");
      expect(result.metadata.extractedLength).toBe(0);
    });

    it("警告メッセージがある場合メタデータに含める", async () => {
      const mockContent = "テスト内容";
      const mockWarning = "Unknown element: w:drawing";
      vi.mocked(mammoth.extractRawText).mockResolvedValueOnce({
        value: mockContent,
        messages: [{ type: "warning", message: mockWarning }],
      });

      const buffer = Buffer.from("dummy docx content");
      const result = await strategy.extract(buffer);

      expect(result.content).toBe(mockContent);
      expect(result.metadata.warnings).toContain(mockWarning);
    });

    it("複数の段落を含むWord文書を処理する", async () => {
      const mockContent =
        "第1章 概要\n\nこれは概要です。\n\n第2章 詳細\n\nこれは詳細です。";
      vi.mocked(mammoth.extractRawText).mockResolvedValueOnce({
        value: mockContent,
        messages: [],
      });

      const buffer = Buffer.from("dummy docx content");
      const result = await strategy.extract(buffer);

      expect(result.content).toBe(mockContent);
      expect(result.content).toContain("第1章");
      expect(result.content).toContain("第2章");
    });

    it("箇条書きを含むWord文書を処理する", async () => {
      const mockContent = "チェックリスト:\n\n・項目1\n・項目2\n・項目3";
      vi.mocked(mammoth.extractRawText).mockResolvedValueOnce({
        value: mockContent,
        messages: [],
      });

      const buffer = Buffer.from("dummy docx content");
      const result = await strategy.extract(buffer);

      expect(result.content).toContain("・項目1");
      expect(result.content).toContain("・項目2");
      expect(result.content).toContain("・項目3");
    });
  });

  describe("異常系", () => {
    it("mammothがエラーを投げた場合エラーを伝搬する", async () => {
      vi.mocked(mammoth.extractRawText).mockRejectedValueOnce(
        new Error("Invalid DOCX file"),
      );

      const buffer = Buffer.from("invalid content");

      await expect(strategy.extract(buffer)).rejects.toThrow(
        "Invalid DOCX file",
      );
    });
  });
});
