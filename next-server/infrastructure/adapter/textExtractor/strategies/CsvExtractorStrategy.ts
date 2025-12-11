import type {
  ITextExtractorStrategy,
  TextExtractionResult,
  TextExtractorOptions,
  TextExtractorType,
} from "@/application/shared/port/textExtractor";
import { CsvParser } from "@/lib/shared/CsvParser";

/**
 * CSVファイル（.csv）の抽出戦略
 * CSVテキストをそのまま抽出する（CSV形式の検証は行う）
 */
export class CsvExtractorStrategy implements ITextExtractorStrategy {
  /**
   * サポートする拡張子を返す
   */
  getSupportedExtensions(): string[] {
    return [".csv"];
  }

  /**
   * 戦略の識別子を返す
   */
  getStrategyType(): TextExtractorType {
    return "csv-default";
  }

  /**
   * テキスト抽出を実行
   * @param buffer ファイルのバイナリデータ
   * @param options 抽出オプション（CSVでは使用しない）
   * @returns 抽出結果
   */
  async extract(
    buffer: Buffer,
    _options?: TextExtractorOptions,
  ): Promise<TextExtractionResult> {
    // UTF-8としてデコード
    const content = buffer.toString("utf-8");

    // CSVの形式を検証
    const validation = CsvParser.validate(content);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    return {
      content,
      metadata: {
        fileType: "csv",
        strategyUsed: this.getStrategyType(),
        originalSize: buffer.length,
        extractedLength: content.length,
      },
    };
  }
}
