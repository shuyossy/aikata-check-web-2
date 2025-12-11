/**
 * CSV解析のためのユーティリティクラス
 * RFC 4180準拠の基本的なCSVパース機能を提供
 * セル内改行や特殊文字を適切に処理する
 */
export class CsvParser {
  /**
   * CSVテキストを解析して2次元配列として返す
   * @param csvText CSVテキスト
   * @returns 2次元配列（行ごとのセル配列）
   */
  public static parse(csvText: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = "";
    let inQuotes = false;
    let i = 0;

    while (i < csvText.length) {
      const char = csvText[i];
      const nextChar = i + 1 < csvText.length ? csvText[i + 1] : null;

      if (!inQuotes) {
        // クォート外の処理
        if (char === '"') {
          // クォート開始
          inQuotes = true;
        } else if (char === ",") {
          // セル区切り
          currentRow.push(currentCell.trim());
          currentCell = "";
        } else if (char === "\n" || char === "\r") {
          // 行区切り
          if (char === "\r" && nextChar === "\n") {
            // CRLF の場合は次の文字もスキップ
            i++;
          }
          currentRow.push(currentCell.trim());
          if (currentRow.length > 0 && !this.isEmptyRow(currentRow)) {
            // Excelファイル抽出時のシート名行（#sheet:で始まる行）をスキップ
            const isSheetNameRow =
              currentRow.length === 1 && currentRow[0].startsWith("#sheet:");
            if (!isSheetNameRow) {
              rows.push(currentRow);
            }
          }
          currentRow = [];
          currentCell = "";
        } else {
          // 通常の文字
          currentCell += char;
        }
      } else {
        // クォート内の処理
        if (char === '"') {
          if (nextChar === '"') {
            // エスケープされたクォート（""）
            currentCell += '"';
            i++; // 次の文字もスキップ
          } else {
            // クォート終了
            inQuotes = false;
          }
        } else {
          // クォート内の文字（改行も含む）
          currentCell += char;
        }
      }

      i++;
    }

    // 最後のセルと行を追加
    currentRow.push(currentCell.trim());
    if (currentRow.length > 0 && !this.isEmptyRow(currentRow)) {
      // Excelファイル抽出時のシート名行（#sheet:で始まる行）をスキップ
      const isSheetNameRow =
        currentRow.length === 1 && currentRow[0].startsWith("#sheet:");
      if (!isSheetNameRow) {
        rows.push(currentRow);
      }
    }

    return rows;
  }

  /**
   * 行が空かどうかを判定する
   * @param row 行データ
   * @returns 空行の場合true
   */
  private static isEmptyRow(row: string[]): boolean {
    return row.every((cell) => cell.trim() === "");
  }

  /**
   * CSVの形式が正しいかを簡易的に検証する
   * @param csvText CSVテキスト
   * @returns 検証結果
   */
  public static validate(csvText: string): {
    isValid: boolean;
    error?: string;
  } {
    try {
      let inQuotes = false;

      for (let i = 0; i < csvText.length; i++) {
        const char = csvText[i];
        const nextChar = i + 1 < csvText.length ? csvText[i + 1] : null;

        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            // エスケープされたクォート
            i++; // 次の文字もスキップ
          } else {
            inQuotes = !inQuotes;
          }
        }
      }

      // クォートが閉じられていない場合
      if (inQuotes) {
        return { isValid: false, error: "クォートが正しく閉じられていません" };
      }

      return { isValid: true };
    } catch (error) {
      return { isValid: false, error: `CSV解析エラー: ${error}` };
    }
  }

  /**
   * CSVフィールドを適切にエスケープする
   * @param field フィールド値
   * @returns エスケープされたフィールド値
   */
  public static escapeField(field: string): string {
    if (field == null) return "";

    const stringField = String(field);
    // ダブルクォートをエスケープ
    const escaped = stringField.replace(/"/g, '""');

    // 改行、カンマ、ダブルクォートが含まれる場合はクォートで囲む
    if (
      escaped.includes(",") ||
      escaped.includes("\n") ||
      escaped.includes("\r") ||
      escaped.includes('"')
    ) {
      return `"${escaped}"`;
    }

    return escaped;
  }

  /**
   * 2次元配列をCSVテキストに変換する
   * @param rows 2次元配列
   * @returns CSVテキスト
   */
  public static stringify(rows: string[][]): string {
    return rows
      .map((row) => row.map((cell) => this.escapeField(cell)).join(","))
      .join("\n");
  }
}
