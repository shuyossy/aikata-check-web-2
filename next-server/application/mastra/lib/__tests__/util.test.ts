import { describe, it, expect } from "vitest";
import {
  makeChunksByCount,
  DEFAULT_CHUNK_OVERLAP,
  splitTextByCount,
  splitImagesByCount,
} from "../util";

describe("makeChunksByCount", () => {
  it("空データの場合は空の範囲を返す", () => {
    const result = makeChunksByCount("", 3, 10);
    expect(result).toEqual([{ start: 0, end: 0 }]);
  });

  it("分割数が0以下の場合は空の範囲を返す", () => {
    const result = makeChunksByCount("abcdef", 0, 10);
    expect(result).toEqual([{ start: 0, end: 0 }]);
  });

  it("分割数が1の場合は全体を返す", () => {
    const result = makeChunksByCount("abcdef", 1, 2);
    expect(result).toEqual([{ start: 0, end: 6 }]);
  });

  it("テキストを2分割する（オーバーラップあり）", () => {
    // 10文字を2分割、オーバーラップ2文字
    const text = "0123456789";
    const result = makeChunksByCount(text, 2, 2);

    // 各チャンクの範囲を確認
    expect(result.length).toBe(2);

    // 最初のチャンク: start=0, end=5+2=7
    expect(result[0].start).toBe(0);
    expect(result[0].end).toBe(7); // ベース5 + オーバーラップ2

    // 2番目のチャンク: start=5-2=3 -> 連続性のためfixedStart=5, end=10
    // 実装では連続性を保つため、前チャンクとの重複を考慮
    expect(result[1].start).toBe(5);
    expect(result[1].end).toBe(10);
  });

  it("テキストを3分割する（オーバーラップあり）", () => {
    // 12文字を3分割、オーバーラップ2文字
    const text = "0123456789AB";
    const result = makeChunksByCount(text, 3, 2);

    expect(result.length).toBe(3);

    // 最初のチャンクは前方オーバーラップなし
    expect(result[0].start).toBe(0);

    // 最後のチャンクは後方オーバーラップなし、末尾まで
    expect(result[2].end).toBe(12);
  });

  it("配列を分割できる", () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = makeChunksByCount(arr, 2, 1);

    expect(result.length).toBe(2);
    // 全体がカバーされていることを確認
    expect(result[result.length - 1].end).toBe(10);
  });

  it("取りこぼしがないことを確認", () => {
    const text = "abcdefghijklmnopqrstuvwxyz";
    const result = makeChunksByCount(text, 5, 3);

    // 全体がカバーされているか確認
    // 各チャンクの範囲が連続または重複していることを確認
    for (let i = 1; i < result.length; i++) {
      // 前のチャンクの終了位置 >= 次のチャンクの開始位置（隙間なし）
      expect(result[i - 1].end).toBeGreaterThanOrEqual(result[i].start);
    }

    // 最後のチャンクが全体の末尾まで届いていることを確認
    expect(result[result.length - 1].end).toBe(text.length);
  });
});


describe("DEFAULT_CHUNK_OVERLAP", () => {
  it("テキスト用のデフォルトオーバーラップが300文字", () => {
    expect(DEFAULT_CHUNK_OVERLAP.TEXT_CHARS).toBe(300);
  });

  it("画像用のデフォルトオーバーラップが3枚", () => {
    expect(DEFAULT_CHUNK_OVERLAP.IMAGE_COUNT).toBe(3);
  });
});

describe("splitTextByCount", () => {
  it("テキストを指定数で分割する", () => {
    const text = "0123456789";
    const result = splitTextByCount(text, 2, 2);

    expect(result.length).toBe(2);
    // 各チャンクがテキストの部分文字列であることを確認
    expect(result[0]).toBe(text.slice(0, 7)); // "0123456"
    expect(result[1]).toBe(text.slice(5, 10)); // "56789"（連続性確保のため）
  });

  it("デフォルトオーバーラップを使用できる", () => {
    const text = "a".repeat(1000);
    const result = splitTextByCount(text, 2);

    expect(result.length).toBe(2);
    // 重複があることを確認
    expect(result[0].length + result[1].length).toBeGreaterThan(text.length);
  });
});

describe("splitImagesByCount", () => {
  it("画像配列を指定数で分割する", () => {
    const images = ["img1", "img2", "img3", "img4", "img5", "img6"];
    const result = splitImagesByCount(images, 2, 1);

    expect(result.length).toBe(2);
    // 各チャンクが元配列の部分配列であることを確認
    expect(result[0].every((img) => images.includes(img))).toBe(true);
    expect(result[1].every((img) => images.includes(img))).toBe(true);
  });

  it("デフォルトオーバーラップを使用できる", () => {
    const images = Array.from({ length: 20 }, (_, i) => `img${i}`);
    const result = splitImagesByCount(images, 2);

    expect(result.length).toBe(2);
    // 重複があることを確認
    const totalItems = result[0].length + result[1].length;
    expect(totalItems).toBeGreaterThan(images.length);
  });
});
