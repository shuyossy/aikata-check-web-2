import { describe, it, expect } from "vitest";
import { TextNormalizer } from "../TextNormalizer";

describe("TextNormalizer", () => {
  const normalizer = new TextNormalizer();

  describe("normalize", () => {
    describe("改行の正規化", () => {
      it("CRLFをLFに変換する", () => {
        const input = "行1\r\n行2\r\n行3";
        const result = normalizer.normalize(input);
        expect(result).toBe("行1\n行2\n行3");
      });

      it("CRをLFに変換する", () => {
        const input = "行1\r行2\r行3";
        const result = normalizer.normalize(input);
        expect(result).toBe("行1\n行2\n行3");
      });

      it("LFはそのまま維持する", () => {
        const input = "行1\n行2\n行3";
        const result = normalizer.normalize(input);
        expect(result).toBe("行1\n行2\n行3");
      });
    });

    describe("制御文字の除去", () => {
      it("NUL文字を除去する", () => {
        const input = "テスト\u0000文字列";
        const result = normalizer.normalize(input);
        expect(result).toBe("テスト文字列");
      });

      it("ベル文字を除去する", () => {
        const input = "テスト\u0007文字列";
        const result = normalizer.normalize(input);
        expect(result).toBe("テスト文字列");
      });

      it("DEL文字を除去する", () => {
        const input = "テスト\u007F文字列";
        const result = normalizer.normalize(input);
        expect(result).toBe("テスト文字列");
      });
    });

    describe("行末空白の削除", () => {
      it("行末の半角スペースを削除する", () => {
        const input = "テスト   ";
        const result = normalizer.normalize(input);
        expect(result).toBe("テスト");
      });

      it("行末の全角スペースを削除する", () => {
        const input = "テスト　　　";
        const result = normalizer.normalize(input);
        expect(result).toBe("テスト");
      });

      it("行末のタブを削除する", () => {
        const input = "テスト\t\t";
        const result = normalizer.normalize(input);
        expect(result).toBe("テスト");
      });

      it("複数行の行末空白を削除する", () => {
        const input = "行1   \n行2\t\t\n行3　　";
        const result = normalizer.normalize(input);
        expect(result).toBe("行1\n行2\n行3");
      });

      it("オプションで無効にできる", () => {
        // 注: 連続空白圧縮が有効なので、3つの空白は1つに圧縮される
        const input = "テスト   ";
        const result = normalizer.normalize(input, { trimLineEndSpaces: false });
        expect(result).toBe("テスト ");
      });
    });

    describe("連続空白の圧縮", () => {
      it("連続する半角スペースを1つに圧縮する", () => {
        const input = "テスト    文字列";
        const result = normalizer.normalize(input);
        expect(result).toBe("テスト 文字列");
      });

      it("連続するタブを1つのスペースに圧縮する", () => {
        const input = "テスト\t\t\t文字列";
        const result = normalizer.normalize(input);
        expect(result).toBe("テスト 文字列");
      });

      it("行頭インデントを保持する（デフォルト）", () => {
        const input = "    インデント付き    テキスト";
        const result = normalizer.normalize(input);
        expect(result).toBe("    インデント付き テキスト");
      });

      it("行頭インデントも圧縮できる", () => {
        const input = "    インデント付き    テキスト";
        const result = normalizer.normalize(input, {
          collapsePreserveIndent: false,
        });
        expect(result).toBe(" インデント付き テキスト");
      });

      it("オプションで無効にできる", () => {
        const input = "テスト    文字列";
        const result = normalizer.normalize(input, {
          collapseConsecutiveWhitespaces: false,
        });
        expect(result).toBe("テスト    文字列");
      });
    });

    describe("カンマのみ行の削除", () => {
      it("カンマのみの行を空行にする", () => {
        const input = "行1\n,,,\n行2";
        const result = normalizer.normalize(input);
        expect(result).toBe("行1\n\n行2");
      });

      it("空白とカンマのみの行を空行にする", () => {
        const input = "行1\n , , , \n行2";
        const result = normalizer.normalize(input);
        expect(result).toBe("行1\n\n行2");
      });

      it("タブとカンマのみの行を空行にする", () => {
        const input = "行1\n\t,\t,\t\n行2";
        const result = normalizer.normalize(input);
        expect(result).toBe("行1\n\n行2");
      });

      it("オプションで無効にできる", () => {
        const input = "行1\n,,,\n行2";
        const result = normalizer.normalize(input, {
          removeCommaOnlyLines: false,
          removeTrailingCommas: false,
        });
        expect(result).toBe("行1\n,,,\n行2");
      });
    });

    describe("行末カンマの削除", () => {
      it("行末のカンマを削除する", () => {
        const input = "テスト,";
        const result = normalizer.normalize(input);
        expect(result).toBe("テスト");
      });

      it("複数の行末カンマを削除する", () => {
        const input = "テスト,,,";
        const result = normalizer.normalize(input);
        expect(result).toBe("テスト");
      });

      it("CSV形式（内部カンマあり）でも行末カンマを削除する", () => {
        const input = "値1,値2,";
        const result = normalizer.normalize(input);
        expect(result).toBe("値1,値2");
      });

      it("クォートを含む行でも行末カンマを削除する", () => {
        const input = '"テスト",';
        const result = normalizer.normalize(input);
        expect(result).toBe('"テスト"');
      });

      it("シートヘッダー行でも行末カンマを削除する", () => {
        const input = "#sheet:Sheet1,";
        const result = normalizer.normalize(input);
        expect(result).toBe("#sheet:Sheet1");
      });

      it("オプションで無効にできる", () => {
        const input = "テスト,";
        const result = normalizer.normalize(input, {
          removeTrailingCommas: false,
        });
        expect(result).toBe("テスト,");
      });

      it("CSV末尾空セルを温存できる", () => {
        const input = "値1,値2,";
        const result = normalizer.normalize(input, {
          preserveCsvTrailingEmptyFields: true,
        });
        expect(result).toBe("値1,値2,");
      });
    });

    describe("空白のみ行の処理", () => {
      it("空白のみの行を空行にする", () => {
        const input = "行1\n   \n行2";
        const result = normalizer.normalize(input);
        expect(result).toBe("行1\n\n行2");
      });

      it("全角スペースのみの行を空行にする", () => {
        const input = "行1\n　　　\n行2";
        const result = normalizer.normalize(input);
        expect(result).toBe("行1\n\n行2");
      });
    });

    describe("連続空行の制限", () => {
      it("デフォルトで連続空行を2行まで許可する", () => {
        // maxConsecutiveBlankLines: 2は連続空行を2回まで許可 = 空行が2つまで
        const input = "行1\n\n\n\n\n行2";
        const result = normalizer.normalize(input);
        expect(result).toBe("行1\n\n\n行2");
      });

      it("連続空行の最大数を指定できる", () => {
        const input = "行1\n\n\n\n\n行2";
        const result = normalizer.normalize(input, {
          maxConsecutiveBlankLines: 3,
        });
        expect(result).toBe("行1\n\n\n\n行2");
      });

      it("連続空行の制限を無効にできる", () => {
        const input = "行1\n\n\n\n\n行2";
        const result = normalizer.normalize(input, {
          maxConsecutiveBlankLines: -1,
        });
        expect(result).toBe("行1\n\n\n\n\n行2");
      });

      it("0を指定すると空行を全て削除する", () => {
        const input = "行1\n\n\n行2";
        const result = normalizer.normalize(input, {
          maxConsecutiveBlankLines: 0,
        });
        expect(result).toBe("行1\n行2");
      });
    });

    describe("複合ケース", () => {
      it("複数の正規化を同時に適用する", () => {
        const input = "  行1   \r\n,,,\r\n  テスト    文字列   \r\n\r\n\r\n\r\n行2,";
        const result = normalizer.normalize(input);
        // カンマのみの行は空行に変換され、連続空行は2つまで許可される
        // 行2, は単一のカンマなので削除される
        expect(result).toBe("  行1\n\n  テスト 文字列\n\n\n行2");
      });
    });
  });

  describe("getDefaultOptions", () => {
    it("デフォルトオプションを返す", () => {
      const options = normalizer.getDefaultOptions();
      expect(options).toEqual({
        collapseConsecutiveWhitespaces: true,
        collapsePreserveIndent: true,
        trimLineEndSpaces: true,
        removeTrailingCommas: true,
        preserveCsvTrailingEmptyFields: false,
        maxConsecutiveBlankLines: 2,
        removeCommaOnlyLines: true,
      });
    });

    it("デフォルトオプションの変更が元のオブジェクトに影響しない", () => {
      const options1 = normalizer.getDefaultOptions();
      options1.maxConsecutiveBlankLines = 10;
      const options2 = normalizer.getDefaultOptions();
      expect(options2.maxConsecutiveBlankLines).toBe(2);
    });
  });
});
