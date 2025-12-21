import { describe, it, expect } from "vitest";
import { formatClientMessage, getMessage } from "../messages";
import { template } from "@/messages/ja/template";

describe("クライアントサイドメッセージヘルパー", () => {
  describe("getMessage", () => {
    it("指定されたコードのメッセージを取得できること", () => {
      const result = getMessage("SUCCESS_CHECKLIST_SAVED");
      expect(result).toBe("チェックリストを保存しました");
    });

    it("存在しないコードの場合はUNKNOWN_ERRORが返されること", () => {
      // @ts-expect-error - 意図的に存在しないコードをテスト
      const result = getMessage("NON_EXISTENT_CODE");
      expect(result).toBe(template.UNKNOWN_ERROR);
    });
  });

  describe("formatClientMessage", () => {
    it("パラメータなしのメッセージをフォーマットできること", () => {
      const result = formatClientMessage("SUCCESS_SETTINGS_SAVED");
      expect(result).toBe("設定を保存しました");
    });

    it("パラメータ付きのメッセージをフォーマットできること", () => {
      const result = formatClientMessage("SUCCESS_CHECKLIST_IMPORTED", { count: 10 });
      expect(result).toBe("10件のチェック項目をインポートしました");
    });

    it("パラメータ付きのエクスポートメッセージをフォーマットできること", () => {
      const result = formatClientMessage("SUCCESS_CHECKLIST_EXPORTED", { count: 5 });
      expect(result).toBe("5件のチェック項目をエクスポートしました");
    });

    it("パラメータ付きのレビュー結果エクスポートメッセージをフォーマットできること", () => {
      const result = formatClientMessage("SUCCESS_REVIEW_RESULT_EXPORTED", { count: 15 });
      expect(result).toBe("15件のレビュー結果をエクスポートしました");
    });

    it("存在しないコードの場合はUNKNOWN_ERRORが返されること", () => {
      // @ts-expect-error - 意図的に存在しないコードをテスト
      const result = formatClientMessage("NON_EXISTENT_CODE");
      expect(result).toBe(template.UNKNOWN_ERROR);
    });

    it("パラメータが指定されていない場合でも動作すること", () => {
      const result = formatClientMessage("SUCCESS_ADMIN_GRANTED");
      expect(result).toBe("管理者権限を付与しました");
    });
  });

  describe("成功メッセージ", () => {
    it.each([
      ["SUCCESS_REVIEW_STARTED", "レビューを開始しました"],
      ["SUCCESS_RETRY_STARTED", "リトライを開始しました"],
      ["SUCCESS_REVIEW_SPACE_UPDATED", "レビュースペースを更新しました"],
      ["SUCCESS_REVIEW_SPACE_DELETED", "レビュースペースを削除しました"],
      ["SUCCESS_REVIEW_TARGET_DELETED", "レビュー対象を削除しました"],
      ["SUCCESS_CHECKLIST_TASK_CANCELLED", "チェックリスト生成タスクをキャンセルしました"],
      ["SUCCESS_ADMIN_REVOKED", "管理者権限を削除しました"],
      ["SUCCESS_NOTIFICATION_CREATED", "通知を作成しました"],
      ["SUCCESS_NOTIFICATION_UPDATED", "通知を更新しました"],
      ["SUCCESS_NOTIFICATION_DELETED", "通知を削除しました"],
    ] as const)("%s が正しいメッセージを返すこと", (code, expected) => {
      const result = getMessage(code);
      expect(result).toBe(expected);
    });
  });

  describe("エラーメッセージ", () => {
    it.each([
      ["ERROR_PDF_CONVERSION_FAILED", "PDFの画像変換に失敗しました"],
      ["ERROR_API_REVIEW_FAILED", "外部APIレビューに失敗しました"],
      ["ERROR_FILE_READ_FAILED", "ファイルの読み込みに失敗しました"],
      ["ERROR_UNSUPPORTED_FILE_FORMAT_CHECKLIST", "サポートされていないファイル形式です。csv, xlsx, xlsファイルを選択してください。"],
      ["ERROR_UNKNOWN", "不明なエラーが発生しました"],
    ] as const)("%s が正しいメッセージを返すこと", (code, expected) => {
      const result = getMessage(code);
      expect(result).toBe(expected);
    });
  });
});
