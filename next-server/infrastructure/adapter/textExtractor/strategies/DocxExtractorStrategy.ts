import mammoth from "mammoth";
import type {
  ITextExtractorStrategy,
  TextExtractionResult,
  TextExtractorOptions,
  TextExtractorType,
} from "@/application/shared/port/textExtractor";

/**
 * Word文書（.docx）の抽出戦略
 * mammothライブラリを使用してテキストを抽出する
 */
export class DocxExtractorStrategy implements ITextExtractorStrategy {
  /**
   * サポートする拡張子を返す
   */
  getSupportedExtensions(): string[] {
    return [".docx"];
  }

  /**
   * 戦略の識別子を返す
   */
  getStrategyType(): TextExtractorType {
    return "docx-mammoth";
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
    // mammothでdocxからテキストを抽出
    const result = await mammoth.extractRawText({ buffer });
    const content = result.value;

    return {
      content,
      metadata: {
        fileType: "docx",
        strategyUsed: this.getStrategyType(),
        originalSize: buffer.length,
        extractedLength: content.length,
        // 警告メッセージがあれば記録
        ...(result.messages.length > 0 && {
          warnings: result.messages.map((m) => m.message),
        }),
      },
    };
  }
}
