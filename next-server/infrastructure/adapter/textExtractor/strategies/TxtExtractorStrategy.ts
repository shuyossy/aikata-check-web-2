import type {
  ITextExtractorStrategy,
  TextExtractionResult,
  TextExtractorOptions,
  TextExtractorType,
} from "@/application/shared/port/textExtractor";

/**
 * テキストファイル（.txt）の抽出戦略
 * ファイル内容をそのままテキストとして抽出する
 */
export class TxtExtractorStrategy implements ITextExtractorStrategy {
  /**
   * サポートする拡張子を返す
   */
  getSupportedExtensions(): string[] {
    return [".txt"];
  }

  /**
   * 戦略の識別子を返す
   */
  getStrategyType(): TextExtractorType {
    return "txt-default";
  }

  /**
   * テキスト抽出を実行
   * @param buffer ファイルのバイナリデータ
   * @param options 抽出オプション
   * @returns 抽出結果
   */
  async extract(
    buffer: Buffer,
    options?: TextExtractorOptions,
  ): Promise<TextExtractionResult> {
    // 指定されたエンコーディングでデコード（デフォルトはUTF-8）
    const encoding = (options?.encoding ?? "utf-8") as BufferEncoding;
    const content = buffer.toString(encoding);

    return {
      content,
      metadata: {
        fileType: "txt",
        strategyUsed: this.getStrategyType(),
        originalSize: buffer.length,
        extractedLength: content.length,
      },
    };
  }
}
