import { describe, it, expect, vi, beforeEach } from "vitest";
import { PdfExtractorStrategy } from "../strategies/PdfExtractorStrategy";

// モック用の関数
const mockGetDocumentProxy = vi.fn();
const mockExtractText = vi.fn();

// unpdfのモック
vi.mock("unpdf", () => ({
  getDocumentProxy: (data: Uint8Array) => mockGetDocumentProxy(data),
  extractText: (pdf: unknown, options: unknown) => mockExtractText(pdf, options),
}));

describe("PdfExtractorStrategy", () => {
  const strategy = new PdfExtractorStrategy();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getSupportedExtensions", () => {
    it(".pdfを返す", () => {
      expect(strategy.getSupportedExtensions()).toEqual([".pdf"]);
    });
  });

  describe("getStrategyType", () => {
    it("unpdfを返す", () => {
      expect(strategy.getStrategyType()).toBe("unpdf");
    });
  });

  describe("正常系", () => {
    it("PDFからテキストを抽出する", async () => {
      const mockPdf = { numPages: 1 };
      const mockContent = ["ドキュメントの内容\n段落1\n段落2"];
      mockGetDocumentProxy.mockResolvedValueOnce(mockPdf);
      mockExtractText.mockResolvedValueOnce({ text: mockContent, totalPages: 1 });

      const buffer = Buffer.from("dummy pdf content");
      const result = await strategy.extract(buffer);

      expect(result.content).toBe("ドキュメントの内容\n段落1\n段落2");
      expect(result.metadata.fileType).toBe("pdf");
      expect(result.metadata.strategyUsed).toBe("unpdf");
      expect(result.metadata.originalSize).toBe(buffer.length);
      expect(mockGetDocumentProxy).toHaveBeenCalledWith(expect.any(Uint8Array));
      expect(mockExtractText).toHaveBeenCalledWith(mockPdf, { mergePages: false });
    });

    it("日本語を含むPDFを正しく処理する", async () => {
      const mockPdf = { numPages: 1 };
      const mockContent = ["チェックリスト\n項目1：確認事項\n項目2：レビュー観点"];
      mockGetDocumentProxy.mockResolvedValueOnce(mockPdf);
      mockExtractText.mockResolvedValueOnce({ text: mockContent, totalPages: 1 });

      const buffer = Buffer.from("dummy pdf content");
      const result = await strategy.extract(buffer);

      expect(result.content).toContain("チェックリスト");
      expect(result.content).toContain("項目1：確認事項");
      expect(result.content).toContain("項目2：レビュー観点");
    });

    it("空のPDFを処理する", async () => {
      const mockPdf = { numPages: 0 };
      mockGetDocumentProxy.mockResolvedValueOnce(mockPdf);
      mockExtractText.mockResolvedValueOnce({ text: [], totalPages: 0 });

      const buffer = Buffer.from("dummy pdf content");
      const result = await strategy.extract(buffer);

      expect(result.content).toBe("");
      expect(result.metadata.extractedLength).toBe(0);
    });

    it("複数ページのPDFを処理する", async () => {
      const mockPdf = { numPages: 2 };
      const mockContent = [
        "第1章 概要\nこれは概要です。",
        "第2章 詳細\nこれは詳細です。",
      ];
      mockGetDocumentProxy.mockResolvedValueOnce(mockPdf);
      mockExtractText.mockResolvedValueOnce({ text: mockContent, totalPages: 2 });

      const buffer = Buffer.from("dummy pdf content");
      const result = await strategy.extract(buffer);

      expect(result.content).toContain("第1章 概要");
      expect(result.content).toContain("これは概要です。");
      expect(result.content).toContain("第2章 詳細");
      expect(result.content).toContain("これは詳細です。");
      // ページ間が空行で区切られている
      expect(result.content).toContain("\n\n");
    });

    it("箇条書きを含むPDFを処理する", async () => {
      const mockPdf = { numPages: 1 };
      const mockContent = ["チェックリスト:\n・項目1\n・項目2\n・項目3"];
      mockGetDocumentProxy.mockResolvedValueOnce(mockPdf);
      mockExtractText.mockResolvedValueOnce({ text: mockContent, totalPages: 1 });

      const buffer = Buffer.from("dummy pdf content");
      const result = await strategy.extract(buffer);

      expect(result.content).toContain("・項目1");
      expect(result.content).toContain("・項目2");
      expect(result.content).toContain("・項目3");
    });

    it("テキストが文字列で返された場合も正しく処理する", async () => {
      const mockPdf = { numPages: 1 };
      const mockContent = "単一の文字列コンテンツ";
      mockGetDocumentProxy.mockResolvedValueOnce(mockPdf);
      mockExtractText.mockResolvedValueOnce({ text: mockContent, totalPages: 1 });

      const buffer = Buffer.from("dummy pdf content");
      const result = await strategy.extract(buffer);

      expect(result.content).toBe("単一の文字列コンテンツ");
    });
  });

  describe("異常系", () => {
    it("getDocumentProxyがエラーを投げた場合エラーを伝搬する", async () => {
      mockGetDocumentProxy.mockRejectedValueOnce(new Error("Invalid PDF file"));

      const buffer = Buffer.from("invalid content");

      await expect(strategy.extract(buffer)).rejects.toThrow("Invalid PDF file");
    });

    it("extractTextがエラーを投げた場合エラーを伝搬する", async () => {
      const mockPdf = { numPages: 1 };
      mockGetDocumentProxy.mockResolvedValueOnce(mockPdf);
      mockExtractText.mockRejectedValueOnce(
        new Error("Failed to extract text"),
      );

      const buffer = Buffer.from("dummy pdf content");

      await expect(strategy.extract(buffer)).rejects.toThrow(
        "Failed to extract text",
      );
    });

    it("破損したPDFファイルの場合エラーを伝搬する", async () => {
      mockGetDocumentProxy.mockRejectedValueOnce(
        new Error("Cannot read PDF: corrupted"),
      );

      const buffer = Buffer.from("corrupted pdf content");

      await expect(strategy.extract(buffer)).rejects.toThrow(
        "Cannot read PDF: corrupted",
      );
    });
  });
});
