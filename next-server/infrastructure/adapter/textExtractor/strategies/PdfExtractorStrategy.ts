import { extractText, getDocumentProxy } from "unpdf";
import type {
  ITextExtractorStrategy,
  TextExtractionResult,
  TextExtractorOptions,
  TextExtractorType,
} from "@/application/shared/port/textExtractor";

/**
 * PDF文書（.pdf）の抽出戦略
 * unpdfライブラリを使用してテキストを抽出する
 * Next.jsサーバーサイドで動作するように設計されている
 */
export class PdfExtractorStrategy implements ITextExtractorStrategy {
  /**
   * サポートする拡張子を返す
   */
  getSupportedExtensions(): string[] {
    return [".pdf"];
  }

  /**
   * 戦略の識別子を返す
   */
  getStrategyType(): TextExtractorType {
    return "unpdf";
  }

  /**
   * テキスト抽出を実行
   * @param buffer ファイルのバイナリデータ
   * @param options 抽出オプション（未使用）
   * @returns 抽出結果
   */
  async extract(
    buffer: Buffer,
    options?: TextExtractorOptions,
  ): Promise<TextExtractionResult> {
    // PDFドキュメントプロキシを取得
    const pdf = await getDocumentProxy(new Uint8Array(buffer));

    // ページごとにテキストを抽出（mergePages: falseでページ配列を取得）
    const { text } = await extractText(pdf, { mergePages: false });

    // ページ間を空行で連結
    const content = Array.isArray(text) ? text.join("\n\n") : text;

    return {
      content,
      metadata: {
        fileType: "pdf",
        strategyUsed: this.getStrategyType(),
        originalSize: buffer.length,
        extractedLength: content.length,
      },
    };
  }
}
