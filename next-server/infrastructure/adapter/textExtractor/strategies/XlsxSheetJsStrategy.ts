import * as XLSX from "xlsx";
import type {
  ITextExtractorStrategy,
  TextExtractionResult,
  TextExtractorOptions,
  TextExtractorType,
} from "@/application/shared/port/textExtractor";

/**
 * Excelファイル（.xlsx, .xls）の抽出戦略
 * SheetJS（xlsx）を使用して全シートをCSV形式のテキストとして抽出する
 * 各シートは「#sheet:シート名」で区切られる
 */
export class XlsxSheetJsStrategy implements ITextExtractorStrategy {
  /**
   * サポートする拡張子を返す
   */
  getSupportedExtensions(): string[] {
    return [".xlsx", ".xls"];
  }

  /**
   * 戦略の識別子を返す
   */
  getStrategyType(): TextExtractorType {
    return "xlsx-sheetjs";
  }

  /**
   * テキスト抽出を実行
   * @param buffer ファイルのバイナリデータ
   * @param _options 抽出オプション（XLSXでは使用しない）
   * @returns 抽出結果
   */
  async extract(
    buffer: Buffer,
    _options?: TextExtractorOptions,
  ): Promise<TextExtractionResult> {
    // ワークブックを読み込み
    const workbook = XLSX.read(buffer, { type: "buffer" });

    const parts: string[] = [];

    // 全シートをCSV形式で出力
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      // シート区切りマーカーを追加
      parts.push(`#sheet:${sheetName}`);

      // シートをCSV形式で出力（空行も含める）
      const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: true });
      parts.push(csv);
    }

    const content = parts.join("\n");

    return {
      content,
      metadata: {
        fileType: "xlsx",
        strategyUsed: this.getStrategyType(),
        originalSize: buffer.length,
        extractedLength: content.length,
      },
    };
  }
}
