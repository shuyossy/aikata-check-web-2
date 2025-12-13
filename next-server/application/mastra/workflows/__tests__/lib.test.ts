import { describe, it, expect } from "vitest";
import { createCombinedMessage } from "../lib";
import type { ExtractedFile } from "../shared/types";

describe("createCombinedMessage", () => {
  describe("テキストファイル処理", () => {
    it("単一のテキストファイルからメッセージを作成する", () => {
      const files: ExtractedFile[] = [
        {
          id: "file-1",
          name: "document.txt",
          type: "text/plain",
          processMode: "text",
          textContent: "これはテストドキュメントの内容です。",
        },
      ];

      const result = createCombinedMessage(files, "Please analyze this document");

      expect(result).toHaveLength(2);
      // 最初のテキストはプロンプトとファイル名
      expect(result[0]).toEqual({
        type: "text",
        text: "Please analyze this document: document.txt",
      });
      // 2番目はファイル内容
      expect(result[1]).toEqual({
        type: "text",
        text: "# document.txt\nこれはテストドキュメントの内容です。",
      });
    });

    it("複数のテキストファイルからメッセージを作成する", () => {
      const files: ExtractedFile[] = [
        {
          id: "file-1",
          name: "document1.txt",
          type: "text/plain",
          processMode: "text",
          textContent: "ドキュメント1の内容",
        },
        {
          id: "file-2",
          name: "document2.txt",
          type: "text/plain",
          processMode: "text",
          textContent: "ドキュメント2の内容",
        },
      ];

      const result = createCombinedMessage(files, "Please analyze these documents");

      expect(result).toHaveLength(3);
      // 最初のテキストはプロンプトとファイル名一覧
      expect(result[0]).toEqual({
        type: "text",
        text: "Please analyze these documents: document1.txt, document2.txt",
      });
      // 各ファイルの内容
      expect(result[1]).toEqual({
        type: "text",
        text: "# document1.txt\nドキュメント1の内容",
      });
      expect(result[2]).toEqual({
        type: "text",
        text: "# document2.txt\nドキュメント2の内容",
      });
    });

    it("textContentが空の場合でも正常に処理される", () => {
      const files: ExtractedFile[] = [
        {
          id: "file-1",
          name: "empty.txt",
          type: "text/plain",
          processMode: "text",
          textContent: "",
        },
      ];

      const result = createCombinedMessage(files, "Please analyze");

      expect(result).toHaveLength(2);
      expect(result[1]).toEqual({
        type: "text",
        text: "# empty.txt\n",
      });
    });

    it("textContentがundefinedの場合でも正常に処理される", () => {
      const files: ExtractedFile[] = [
        {
          id: "file-1",
          name: "no-content.txt",
          type: "text/plain",
          processMode: "text",
        },
      ];

      const result = createCombinedMessage(files, "Please analyze");

      expect(result).toHaveLength(2);
      expect(result[1]).toEqual({
        type: "text",
        text: "# no-content.txt\n",
      });
    });
  });

  describe("画像ファイル処理", () => {
    it("単一ページの画像ファイルからメッセージを作成する", () => {
      const files: ExtractedFile[] = [
        {
          id: "file-1",
          name: "document.pdf",
          type: "application/pdf",
          processMode: "image",
          imageData: ["base64encodedimage1"],
        },
      ];

      const result = createCombinedMessage(files, "Please analyze this document");

      expect(result).toHaveLength(3);
      // 最初のテキストはプロンプトとファイル名
      expect(result[0]).toEqual({
        type: "text",
        text: "Please analyze this document: document.pdf",
      });
      // ページ説明
      expect(result[1]).toEqual({
        type: "text",
        text: "# document.pdf: Page 1/1",
      });
      // 画像データ
      expect(result[2]).toEqual({
        type: "image",
        image: "base64encodedimage1",
        mimeType: "image/png",
      });
    });

    it("複数ページの画像ファイルからメッセージを作成する", () => {
      const files: ExtractedFile[] = [
        {
          id: "file-1",
          name: "multipage.pdf",
          type: "application/pdf",
          processMode: "image",
          imageData: ["page1image", "page2image", "page3image"],
        },
      ];

      const result = createCombinedMessage(files, "Please analyze");

      // プロンプト + 3ページ分（説明 + 画像）× 3
      expect(result).toHaveLength(7);
      expect(result[0]).toEqual({
        type: "text",
        text: "Please analyze: multipage.pdf",
      });

      // Page 1
      expect(result[1]).toEqual({
        type: "text",
        text: "# multipage.pdf: Page 1/3",
      });
      expect(result[2]).toEqual({
        type: "image",
        image: "page1image",
        mimeType: "image/png",
      });

      // Page 2
      expect(result[3]).toEqual({
        type: "text",
        text: "# multipage.pdf: Page 2/3",
      });
      expect(result[4]).toEqual({
        type: "image",
        image: "page2image",
        mimeType: "image/png",
      });

      // Page 3
      expect(result[5]).toEqual({
        type: "text",
        text: "# multipage.pdf: Page 3/3",
      });
      expect(result[6]).toEqual({
        type: "image",
        image: "page3image",
        mimeType: "image/png",
      });
    });

    it("imageDataが空配列の場合、テキストモードとして処理される", () => {
      const files: ExtractedFile[] = [
        {
          id: "file-1",
          name: "empty-image.pdf",
          type: "application/pdf",
          processMode: "image",
          imageData: [],
        },
      ];

      const result = createCombinedMessage(files, "Please analyze");

      // imageDataが空の場合はテキストモードにフォールバック
      expect(result).toHaveLength(2);
      expect(result[1]).toEqual({
        type: "text",
        text: "# empty-image.pdf\n",
      });
    });

    it("imageDataがundefinedの場合、テキストモードとして処理される", () => {
      const files: ExtractedFile[] = [
        {
          id: "file-1",
          name: "no-image.pdf",
          type: "application/pdf",
          processMode: "image",
        },
      ];

      const result = createCombinedMessage(files, "Please analyze");

      // imageDataがundefinedの場合はテキストモードにフォールバック
      expect(result).toHaveLength(2);
      expect(result[1]).toEqual({
        type: "text",
        text: "# no-image.pdf\n",
      });
    });
  });

  describe("混合ファイル処理", () => {
    it("テキストと画像の混合ファイルからメッセージを作成する", () => {
      const files: ExtractedFile[] = [
        {
          id: "file-1",
          name: "text-doc.txt",
          type: "text/plain",
          processMode: "text",
          textContent: "テキストファイルの内容",
        },
        {
          id: "file-2",
          name: "image-doc.pdf",
          type: "application/pdf",
          processMode: "image",
          imageData: ["imagedata1", "imagedata2"],
        },
        {
          id: "file-3",
          name: "another-text.txt",
          type: "text/plain",
          processMode: "text",
          textContent: "別のテキストファイル",
        },
      ];

      const result = createCombinedMessage(files, "Please analyze all documents");

      // プロンプト(1) + テキスト1(1) + 画像2ページ(説明2 + 画像2 = 4) + テキスト2(1) = 7
      expect(result).toHaveLength(7);

      // プロンプトとファイル名一覧
      expect(result[0]).toEqual({
        type: "text",
        text: "Please analyze all documents: text-doc.txt, image-doc.pdf, another-text.txt",
      });

      // テキストファイル1
      expect(result[1]).toEqual({
        type: "text",
        text: "# text-doc.txt\nテキストファイルの内容",
      });

      // 画像ファイル Page 1
      expect(result[2]).toEqual({
        type: "text",
        text: "# image-doc.pdf: Page 1/2",
      });
      expect(result[3]).toEqual({
        type: "image",
        image: "imagedata1",
        mimeType: "image/png",
      });

      // 画像ファイル Page 2
      expect(result[4]).toEqual({
        type: "text",
        text: "# image-doc.pdf: Page 2/2",
      });
      expect(result[5]).toEqual({
        type: "image",
        image: "imagedata2",
        mimeType: "image/png",
      });

      // テキストファイル2（index 6）
      expect(result[6]).toEqual({
        type: "text",
        text: "# another-text.txt\n別のテキストファイル",
      });
    });
  });

  describe("空ファイルリスト", () => {
    it("ファイルが空の場合、プロンプトのみが返される", () => {
      const files: ExtractedFile[] = [];

      const result = createCombinedMessage(files, "Please analyze");

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: "text",
        text: "Please analyze: ",
      });
    });
  });
});
