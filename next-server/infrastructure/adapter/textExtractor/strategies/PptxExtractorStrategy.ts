import officeParser from "officeparser";
import type {
  ITextExtractorStrategy,
  TextExtractionResult,
  TextExtractorOptions,
  TextExtractorType,
} from "@/application/shared/port/textExtractor";

/**
 * PowerPoint文書（.pptx）の抽出戦略
 * officeparserライブラリを使用してテキストを抽出する
 */
export class PptxExtractorStrategy implements ITextExtractorStrategy {
  /**
   * サポートする拡張子を返す
   */
  getSupportedExtensions(): string[] {
    return [".pptx"];
  }

  /**
   * 戦略の識別子を返す
   */
  getStrategyType(): TextExtractorType {
    return "pptx-officeparser";
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
    // officeparserでpptxからテキストを抽出
    // 注意: officeparser v5ではpreserveLineBreaksオプションは存在しない
    // newlineDelimiterオプションでデフォルトの\nが使用される
    const content = await officeParser.parseOfficeAsync(buffer);

    return {
      content,
      metadata: {
        fileType: "pptx",
        strategyUsed: this.getStrategyType(),
        originalSize: buffer.length,
        extractedLength: content.length,
      },
    };
  }
}
