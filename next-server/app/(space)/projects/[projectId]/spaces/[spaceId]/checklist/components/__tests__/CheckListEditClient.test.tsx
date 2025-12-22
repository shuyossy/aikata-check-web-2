import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckListEditClient } from "../CheckListEditClient";

// next/navigation のモック
const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

// ポーリングフックのモック
vi.mock("../../hooks/useChecklistTaskPolling", () => ({
  useChecklistTaskPolling: vi.fn(() => ({
    isPolling: false,
  })),
}));

// アクションのモック関数
const mockExecuteBulkSave = vi.fn();
const mockExecuteExportCsv = vi.fn();
const mockExecuteCancelTask = vi.fn();

// useActionのモック - 各アクションに対応するexecute関数を返す
vi.mock("next-safe-action/hooks", () => {
  return {
    useAction: vi.fn().mockImplementation((action, options) => {
      // アクション関数の名前や特性から識別
      const actionStr = action?.toString() || "";

      // bulkSaveCheckListItemsActionの場合
      if (
        actionStr.includes("bulkSave") ||
        (action && action._actionType === "bulkSave")
      ) {
        return {
          execute: (data: unknown) => {
            mockExecuteBulkSave(data);
            options?.onSuccess?.({ data: { savedCount: 1 } });
          },
          isExecuting: false,
        };
      }

      // exportCheckListToCsvActionの場合
      if (
        actionStr.includes("exportCsv") ||
        (action && action._actionType === "exportCsv")
      ) {
        return {
          execute: mockExecuteExportCsv,
          isExecuting: false,
        };
      }

      // cancelChecklistGenerationTaskActionの場合
      if (
        actionStr.includes("cancelTask") ||
        (action && action._actionType === "cancelTask")
      ) {
        return {
          execute: mockExecuteCancelTask,
          isExecuting: false,
        };
      }

      // デフォルト - bulkSaveとして扱う（最初に呼ばれるのがbulkSave）
      return {
        execute: (data: unknown) => {
          mockExecuteBulkSave(data);
          options?.onSuccess?.({ data: { savedCount: 1 } });
        },
        isExecuting: false,
      };
    }),
  };
});

// アクションモジュール全体をモック
vi.mock("../actions", () => ({
  bulkSaveCheckListItemsAction: Object.assign(() => {}, {
    _actionType: "bulkSave",
  }),
  exportCheckListToCsvAction: Object.assign(() => {}, {
    _actionType: "exportCsv",
  }),
  cancelChecklistGenerationTaskAction: Object.assign(() => {}, {
    _actionType: "cancelTask",
  }),
}));

// sonnerのモック
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// @/lib/client のモック
vi.mock("@/lib/client", () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
  getMessage: vi.fn((code: string) => code),
  formatClientMessage: vi.fn((code: string) => code),
}));

describe("CheckListEditClient", () => {
  // テスト用の基本props
  const baseProps = {
    projectId: "project-1",
    projectName: "テストプロジェクト",
    spaceId: "space-1",
    spaceName: "テストスペース",
    initialItems: [
      { id: "item-1", content: "チェック項目1" },
      { id: "item-2", content: "チェック項目2" },
      { id: "item-3", content: "チェック項目3" },
    ],
    initialTotal: 3,
    taskStatus: {
      hasTask: false,
      status: null,
      errorMessage: null,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("初期状態", () => {
    it("初期表示時、全てのアイテムが正常に表示されること", () => {
      render(<CheckListEditClient {...baseProps} />);

      // Textareaに値が設定されていることを確認
      const textareas = screen.getAllByPlaceholderText("チェック項目を入力...");
      expect(textareas).toHaveLength(3);
      expect(textareas[0]).toHaveValue("チェック項目1");
      expect(textareas[1]).toHaveValue("チェック項目2");
      expect(textareas[2]).toHaveValue("チェック項目3");

      // 項目数表示を確認
      expect(screen.getByText(/合計/)).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
    });
  });

  describe("項目追加", () => {
    it("項目追加時、DBに保存されないこと（ローカルのみ）", async () => {
      const user = userEvent.setup();
      render(<CheckListEditClient {...baseProps} />);

      // 「項目を追加」ボタンをクリック
      const addButton = screen.getByRole("button", { name: /項目を追加/ });
      await user.click(addButton);

      // 新しい項目が追加されていることを確認
      const textareas = screen.getAllByPlaceholderText("チェック項目を入力...");
      expect(textareas).toHaveLength(4); // 既存3 + 新規1

      // DBに保存が呼ばれていないことを確認
      expect(mockExecuteBulkSave).not.toHaveBeenCalled();

      // 未入力の項目メッセージが表示されることを確認
      expect(screen.getByText("未入力の項目があります")).toBeInTheDocument();
    });
  });

  describe("項目編集", () => {
    it("項目編集時、DBに保存されないこと（ローカルのみ）", async () => {
      const user = userEvent.setup();
      render(<CheckListEditClient {...baseProps} />);

      // 最初の項目のテキストエリアを取得
      const textareas = screen.getAllByPlaceholderText("チェック項目を入力...");
      const firstTextarea = textareas[0];

      // 内容を変更
      await user.clear(firstTextarea);
      await user.type(firstTextarea, "編集後の内容");

      // DBに保存が呼ばれていないことを確認
      expect(mockExecuteBulkSave).not.toHaveBeenCalled();

      // 未保存の変更メッセージが表示されることを確認
      expect(screen.getByText("未保存の変更があります")).toBeInTheDocument();
    });
  });

  describe("項目削除（単体）", () => {
    it("既存アイテム削除時、削除予定状態になること（DBに保存されない）", async () => {
      const user = userEvent.setup();
      render(<CheckListEditClient {...baseProps} />);

      // 最初の項目の削除ボタンをクリック
      const deleteButtons = screen
        .getAllByRole("button", { name: "" })
        .filter((button) => button.querySelector("svg.lucide-trash-2"));
      await user.click(deleteButtons[0]);

      // 復元ボタンが表示されることを確認（削除予定状態になった証拠）
      await waitFor(() => {
        const restoreButtons = screen
          .getAllByRole("button", { name: "" })
          .filter((button) => button.querySelector("svg.lucide-undo-2"));
        expect(restoreButtons).toHaveLength(1);
      });

      // 削除予定のアイテムに取り消し線が表示されていることを確認
      expect(screen.getByText("チェック項目1")).toHaveClass("line-through");

      // 未保存の変更メッセージが表示されることを確認
      expect(screen.getByText("未保存の変更があります")).toBeInTheDocument();
    });

    it("新規アイテムを削除した場合、リストから完全に削除されること", async () => {
      const user = userEvent.setup();
      render(<CheckListEditClient {...baseProps} />);

      // 新規項目を追加
      const addButton = screen.getByRole("button", { name: /項目を追加/ });
      await user.click(addButton);

      // 項目数が4になっていることを確認
      let textareas = screen.getAllByPlaceholderText("チェック項目を入力...");
      expect(textareas).toHaveLength(4);

      // 新規追加された項目（最後の項目）の削除ボタンをクリック
      const deleteButtons = screen
        .getAllByRole("button", { name: "" })
        .filter((button) => button.querySelector("svg.lucide-trash-2"));
      await user.click(deleteButtons[deleteButtons.length - 1]);

      // 項目数が3に戻っていることを確認（削除予定ではなく完全削除）
      textareas = screen.getAllByPlaceholderText("チェック項目を入力...");
      expect(textareas).toHaveLength(3);
    });
  });

  describe("項目削除（一括）", () => {
    it("一括削除時、選択した既存アイテムが削除予定状態になること（DBに保存されない）", async () => {
      const user = userEvent.setup();
      render(<CheckListEditClient {...baseProps} />);

      // 最初の2項目を選択
      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[1]); // 最初の項目のチェックボックス（0はヘッダーの全選択）
      await user.click(checkboxes[2]); // 2番目の項目のチェックボックス

      // 削除ボタンをクリック（ヘッダーの削除ボタン）
      const bulkDeleteButton = screen.getByRole("button", { name: /削除/ });
      await user.click(bulkDeleteButton);

      // 復元ボタンが2つ表示されることを確認
      await waitFor(() => {
        const restoreButtons = screen
          .getAllByRole("button", { name: "" })
          .filter((button) => button.querySelector("svg.lucide-undo-2"));
        expect(restoreButtons).toHaveLength(2);
      });
    });
  });

  describe("削除予定アイテムの復元", () => {
    it("削除予定アイテムの復元ができること", async () => {
      const user = userEvent.setup();
      render(<CheckListEditClient {...baseProps} />);

      // 最初の項目を削除
      const deleteButtons = screen
        .getAllByRole("button", { name: "" })
        .filter((button) => button.querySelector("svg.lucide-trash-2"));
      await user.click(deleteButtons[0]);

      // 復元ボタンが表示されることを確認
      let restoreButtons: HTMLElement[] = [];
      await waitFor(() => {
        restoreButtons = screen
          .getAllByRole("button", { name: "" })
          .filter((button) => button.querySelector("svg.lucide-undo-2"));
        expect(restoreButtons).toHaveLength(1);
      });

      // 復元ボタンをクリック
      await user.click(restoreButtons[0]);

      // 復元ボタンがなくなり、削除ボタンに戻っていることを確認
      await waitFor(() => {
        const currentRestoreButtons = screen
          .getAllByRole("button", { name: "" })
          .filter((button) => button.querySelector("svg.lucide-undo-2"));
        expect(currentRestoreButtons).toHaveLength(0);
      });

      // テキストエリアが再び表示されていることを確認（削除予定状態ではなくなった）
      const textareas = screen.getAllByPlaceholderText("チェック項目を入力...");
      expect(textareas).toHaveLength(3);
    });
  });

  describe("変更の保存", () => {
    it("「変更を保存」押下時、削除予定アイテムを除外して保存されること", async () => {
      render(<CheckListEditClient {...baseProps} />);

      // 最初の項目の削除ボタンをクリック
      const deleteButtons = screen
        .getAllByRole("button", { name: "" })
        .filter((button) => button.querySelector("svg.lucide-trash-2"));
      fireEvent.click(deleteButtons[0]);

      // 復元ボタンが表示されるまで待機（削除予定状態になったことを確認）
      await waitFor(() => {
        const restoreButtons = screen
          .getAllByRole("button", { name: "" })
          .filter((button) => button.querySelector("svg.lucide-undo-2"));
        expect(restoreButtons).toHaveLength(1);
      });

      // 保存ボタンをクリック
      const saveButton = screen.getByRole("button", { name: /変更を保存/ });
      fireEvent.click(saveButton);

      // 保存が呼ばれたことを確認
      await waitFor(() => {
        expect(mockExecuteBulkSave).toHaveBeenCalledTimes(1);
      });

      // 保存時のcontentsに削除予定の項目（チェック項目1）が含まれていないことを確認
      const savedData = mockExecuteBulkSave.mock.calls[0][0];
      expect(savedData.contents).not.toContain("チェック項目1");
      expect(savedData.contents).toContain("チェック項目2");
      expect(savedData.contents).toContain("チェック項目3");
    });

    it("全アイテム削除後の保存で空配列が送信されること", async () => {
      render(<CheckListEditClient {...baseProps} />);

      // 全選択
      const selectAllCheckbox = screen.getAllByRole("checkbox")[0];
      fireEvent.click(selectAllCheckbox);

      // 一括削除
      const bulkDeleteButton = screen.getByRole("button", { name: /削除/ });
      fireEvent.click(bulkDeleteButton);

      // 復元ボタンが3つ表示されるまで待機
      await waitFor(() => {
        const restoreButtons = screen
          .getAllByRole("button", { name: "" })
          .filter((button) => button.querySelector("svg.lucide-undo-2"));
        expect(restoreButtons).toHaveLength(3);
      });

      // 保存ボタンをクリック
      const saveButton = screen.getByRole("button", { name: /変更を保存/ });
      fireEvent.click(saveButton);

      // 空配列で保存が呼ばれたことを確認
      await waitFor(() => {
        expect(mockExecuteBulkSave).toHaveBeenCalledWith({
          reviewSpaceId: "space-1",
          contents: [],
        });
      });
    });

    it("保存成功後、削除予定アイテムがUIから削除されること", async () => {
      render(<CheckListEditClient {...baseProps} />);

      // 最初の項目を削除予定にする
      const deleteButtons = screen
        .getAllByRole("button", { name: "" })
        .filter((button) => button.querySelector("svg.lucide-trash-2"));
      fireEvent.click(deleteButtons[0]);

      // 復元ボタンが表示されるまで待機（削除予定状態になったことを確認）
      await waitFor(() => {
        const restoreButtons = screen
          .getAllByRole("button", { name: "" })
          .filter((button) => button.querySelector("svg.lucide-undo-2"));
        expect(restoreButtons).toHaveLength(1);
      });

      // 保存ボタンをクリック
      const saveButton = screen.getByRole("button", { name: /変更を保存/ });
      fireEvent.click(saveButton);

      // 保存成功後、削除予定アイテムがUIから消えていることを確認
      await waitFor(() => {
        const textareas =
          screen.getAllByPlaceholderText("チェック項目を入力...");
        expect(textareas).toHaveLength(2); // 3から2に減少
      });

      // 復元ボタンもなくなっていることを確認
      const restoreButtons = screen
        .getAllByRole("button", { name: "" })
        .filter((button) => button.querySelector("svg.lucide-undo-2"));
      expect(restoreButtons).toHaveLength(0);
    });
  });

  describe("削除予定アイテムの選択", () => {
    it("削除予定アイテムは選択不可であること", async () => {
      const user = userEvent.setup();
      render(<CheckListEditClient {...baseProps} />);

      // 最初の項目を削除
      const deleteButtons = screen
        .getAllByRole("button", { name: "" })
        .filter((button) => button.querySelector("svg.lucide-trash-2"));
      await user.click(deleteButtons[0]);

      // 削除予定の項目のチェックボックスが無効化されていることを確認
      await waitFor(() => {
        const checkboxes = screen.getAllByRole("checkbox");
        // 削除予定アイテムのチェックボックスはdisabledになる
        expect(checkboxes[1]).toBeDisabled();
      });
    });

    it("全選択時、削除予定アイテムは選択対象から除外されること", async () => {
      const user = userEvent.setup();
      render(<CheckListEditClient {...baseProps} />);

      // 最初の項目を削除
      const deleteButtons = screen
        .getAllByRole("button", { name: "" })
        .filter((button) => button.querySelector("svg.lucide-trash-2"));
      await user.click(deleteButtons[0]);

      // 削除予定状態になるまで待機
      await waitFor(() => {
        const restoreButtons = screen
          .getAllByRole("button", { name: "" })
          .filter((button) => button.querySelector("svg.lucide-undo-2"));
        expect(restoreButtons).toHaveLength(1);
      });

      // 全選択
      const selectAllCheckbox = screen.getAllByRole("checkbox")[0];
      await user.click(selectAllCheckbox);

      // 削除予定でない項目のみが選択されていることを確認
      const checkboxes = screen.getAllByRole("checkbox");
      // ヘッダー(0)は全選択、item-1(1)は削除予定でdisabled、item-2(2)とitem-3(3)は選択されている
      expect(checkboxes[2]).toBeChecked();
      expect(checkboxes[3]).toBeChecked();
    });
  });
});
