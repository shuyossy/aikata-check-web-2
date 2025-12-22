import type {
  ITextNormalizer,
  TextNormalizerOptions,
} from "@/application/shared/port/textExtractor";

/**
 * デフォルトの正規化オプション
 */
const DEFAULT_OPTIONS: TextNormalizerOptions = {
  collapseConsecutiveWhitespaces: true,
  collapsePreserveIndent: true,
  trimLineEndSpaces: true,
  removeTrailingCommas: true,
  preserveCsvTrailingEmptyFields: false,
  maxConsecutiveBlankLines: 2,
  removeCommaOnlyLines: true,
};

/**
 * テキスト正規化の実装
 * 抽出されたテキストの後処理を行う
 */
export class TextNormalizer implements ITextNormalizer {
  /**
   * テキストを正規化する
   * @param text 正規化対象のテキスト
   * @param options 正規化オプション（部分指定可能）
   * @returns 正規化されたテキスト
   */
  normalize(text: string, options?: Partial<TextNormalizerOptions>): string {
    const policy: TextNormalizerOptions = {
      ...DEFAULT_OPTIONS,
      ...(options ?? {}),
    };

    // 改行を LF に正規化
    let normalizedText = text.replace(/\r\n?/g, "\n");

    // 制御文字を除去（タブ、改行、キャリッジリターン以外）
    normalizedText = normalizedText.replace(
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,
      "",
    );

    const lines = normalizedText.split("\n").map((line) => {
      let current = line;

      // (1) 行末空白削除
      if (policy.trimLineEndSpaces) {
        current = current.replace(/(?:\p{White_Space}|\p{Cf})+$/gu, "");
      }

      // (2) 連続空白の圧縮（行頭インデント保護可）
      const SPACE_RUN = /[\p{Zs}\t\f\v]{2,}/gu;
      if (policy.collapseConsecutiveWhitespaces) {
        if (policy.collapsePreserveIndent) {
          const indentMatch = current.match(/^[\p{Zs}\t\f\v]*/u);
          const indent = indentMatch ? indentMatch[0] : "";
          const rest = current.slice(indent.length);
          current = indent + rest.replace(SPACE_RUN, " ");
        } else {
          current = current.replace(SPACE_RUN, " ");
        }
      }

      // (3) カンマのみ行（空白は無視）を削除
      if (policy.removeCommaOnlyLines) {
        const commaOnly =
          /^[\p{White_Space}\p{Cf}]*(?:,[\p{White_Space}\p{Cf}]*)+$/u;
        if (commaOnly.test(current)) {
          current = "";
        }
      }

      // (4) 行末カンマの削除（CSV末尾空セルは温存可）
      if (policy.removeTrailingCommas) {
        const endsWithComma = /,+$/.test(current);
        if (endsWithComma) {
          if (policy.preserveCsvTrailingEmptyFields) {
            const hasInnerComma = /,.*,[^,]*$/.test(current);
            const hasQuote = /"/.test(current);
            const isSheetHeader = current.startsWith("#sheet:");
            if (!(hasInnerComma || hasQuote || isSheetHeader)) {
              current = current.replace(/,+$/u, "");
            }
          } else {
            current = current.replace(/,+$/u, "");
          }
        }
      }

      // (5) 空白のみ行は空行へ
      if (/^[\p{White_Space}\p{Cf}]+$/u.test(current)) {
        current = "";
      }

      return current;
    });

    // (6) 空行の連続を制限
    if (policy.maxConsecutiveBlankLines >= 0) {
      const out: string[] = [];
      let blankRun = 0;
      for (const l of lines) {
        if (l.length === 0) {
          blankRun += 1;
          if (blankRun <= policy.maxConsecutiveBlankLines) out.push("");
        } else {
          blankRun = 0;
          out.push(l);
        }
      }
      return out.join("\n");
    }

    return lines.join("\n");
  }

  /**
   * デフォルトのオプションを取得
   * @returns デフォルトの正規化オプション
   */
  getDefaultOptions(): TextNormalizerOptions {
    return { ...DEFAULT_OPTIONS };
  }
}
