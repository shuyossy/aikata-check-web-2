import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemberSearchModal } from "../MemberSearchModal";
import { UserDto } from "@/domain/user";

// next-safe-actionのモック
const mockExecute = vi.fn();
vi.mock("next-safe-action/hooks", () => ({
  useAction: vi.fn((action, options) => {
    // モックの実行時にオプションを保持
    (globalThis as Record<string, unknown>).__mockActionOptions = options;
    return {
      execute: mockExecute,
      isPending: false,
    };
  }),
}));

// searchUsersActionのモック
vi.mock("@/app/projects/actions", () => ({
  searchUsersAction: vi.fn(),
}));

describe("MemberSearchModal", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    initialSelected: [],
    excludeUserIds: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockClear();
  });

  describe("正常系", () => {
    it("モーダルが開いている時はコンテンツが表示される", () => {
      render(<MemberSearchModal {...defaultProps} />);

      expect(screen.getByText("メンバーを検索")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("氏名または社員IDで検索..."),
      ).toBeInTheDocument();
    });

    it("モーダルが閉じている時はコンテンツが表示されない", () => {
      render(<MemberSearchModal {...defaultProps} isOpen={false} />);

      expect(screen.queryByText("メンバーを検索")).not.toBeInTheDocument();
    });

    it("検索入力ができる", async () => {
      const user = userEvent.setup();
      render(<MemberSearchModal {...defaultProps} />);

      const input = screen.getByPlaceholderText("氏名または社員IDで検索...");
      await user.type(input, "テスト");

      expect(input).toHaveValue("テスト");
    });

    it("検索ボタンをクリックすると検索が実行される", async () => {
      const user = userEvent.setup();
      render(<MemberSearchModal {...defaultProps} />);

      const input = screen.getByPlaceholderText("氏名または社員IDで検索...");
      await user.type(input, "テスト");

      const searchButton = screen.getByText("検索");
      await user.click(searchButton);

      expect(mockExecute).toHaveBeenCalledWith({
        query: "テスト",
        page: 1,
        limit: 10,
      });
    });

    it("Enterキーを押すと検索が実行される", async () => {
      const user = userEvent.setup();
      render(<MemberSearchModal {...defaultProps} />);

      const input = screen.getByPlaceholderText("氏名または社員IDで検索...");
      await user.type(input, "テスト{Enter}");

      expect(mockExecute).toHaveBeenCalledWith({
        query: "テスト",
        page: 1,
        limit: 10,
      });
    });

    it("検索ボックスが空の場合は検索ボタンが無効になる", () => {
      render(<MemberSearchModal {...defaultProps} />);

      const searchButton = screen.getByText("検索");
      expect(searchButton).toBeDisabled();
    });

    it("初期メッセージが表示される", () => {
      render(<MemberSearchModal {...defaultProps} />);

      expect(
        screen.getByText("氏名または社員IDで検索してください"),
      ).toBeInTheDocument();
    });

    it("選択中カウントが表示される", () => {
      render(<MemberSearchModal {...defaultProps} />);

      expect(screen.getByText("選択中:")).toBeInTheDocument();
      expect(screen.getByText("0名")).toBeInTheDocument();
    });

    it("初期選択済みユーザーがカウントに反映される", () => {
      const initialSelected: UserDto[] = [
        { id: "user-1", employeeId: "EMP001", displayName: "ユーザー1" },
        { id: "user-2", employeeId: "EMP002", displayName: "ユーザー2" },
      ];

      render(
        <MemberSearchModal
          {...defaultProps}
          initialSelected={initialSelected}
        />,
      );

      expect(screen.getByText("2名")).toBeInTheDocument();
    });
  });

  describe("モーダル操作", () => {
    it("閉じるボタンをクリックするとonCloseが呼ばれる", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<MemberSearchModal {...defaultProps} onClose={onClose} />);

      // 閉じるボタン（×アイコン）をクリック
      const closeButtons = screen.getAllByRole("button");
      const closeButton = closeButtons.find((btn) =>
        btn.querySelector("svg path[d*='M6 18L18 6M6 6l12 12']"),
      );
      if (closeButton) {
        await user.click(closeButton);
        expect(onClose).toHaveBeenCalledTimes(1);
      }
    });

    it("キャンセルボタンをクリックするとonCloseが呼ばれる", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<MemberSearchModal {...defaultProps} onClose={onClose} />);

      const cancelButton = screen.getByText("キャンセル");
      await user.click(cancelButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("選択を確定ボタンをクリックするとonConfirmとonCloseが呼ばれる", async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();
      const onClose = vi.fn();
      const initialSelected: UserDto[] = [
        { id: "user-1", employeeId: "EMP001", displayName: "ユーザー1" },
      ];

      render(
        <MemberSearchModal
          {...defaultProps}
          onConfirm={onConfirm}
          onClose={onClose}
          initialSelected={initialSelected}
        />,
      );

      const confirmButton = screen.getByText("選択を確定");
      await user.click(confirmButton);

      expect(onConfirm).toHaveBeenCalledWith(initialSelected);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("エラー表示", () => {
    it("エラーメッセージが表示される", async () => {
      const user = userEvent.setup();
      render(<MemberSearchModal {...defaultProps} />);

      // 検索を実行
      const input = screen.getByPlaceholderText("氏名または社員IDで検索...");
      await user.type(input, "テスト");

      const searchButton = screen.getByText("検索");
      await user.click(searchButton);

      // エラーコールバックをシミュレート
      const options = (globalThis as Record<string, unknown>)
        .__mockActionOptions as {
        onError: (arg: {
          error: { serverError: { message: string } | null };
        }) => void;
      };
      if (options?.onError) {
        options.onError({
          error: {
            serverError: { message: "ユーザー検索でエラーが発生しました" },
          },
        });
      }

      await waitFor(() => {
        expect(
          screen.getByText("ユーザー検索でエラーが発生しました"),
        ).toBeInTheDocument();
      });
    });

    it("サーバエラーがない場合はデフォルトメッセージが表示される", async () => {
      const user = userEvent.setup();
      render(<MemberSearchModal {...defaultProps} />);

      const input = screen.getByPlaceholderText("氏名または社員IDで検索...");
      await user.type(input, "テスト");

      const searchButton = screen.getByText("検索");
      await user.click(searchButton);

      // エラーコールバックをシミュレート（serverErrorなし）
      const options = (globalThis as Record<string, unknown>)
        .__mockActionOptions as {
        onError: (arg: { error: { serverError: null } }) => void;
      };
      if (options?.onError) {
        options.onError({
          error: {
            serverError: null,
          },
        });
      }

      await waitFor(() => {
        expect(
          screen.getByText("ユーザー検索に失敗しました。"),
        ).toBeInTheDocument();
      });
    });
  });

  describe("検索結果表示", () => {
    it("検索成功時に結果が表示される", async () => {
      const user = userEvent.setup();
      render(<MemberSearchModal {...defaultProps} />);

      const input = screen.getByPlaceholderText("氏名または社員IDで検索...");
      await user.type(input, "テスト");

      const searchButton = screen.getByText("検索");
      await user.click(searchButton);

      // 成功コールバックをシミュレート
      const options = (globalThis as Record<string, unknown>)
        .__mockActionOptions as {
        onSuccess: (arg: { data: { users: UserDto[]; total: number } }) => void;
      };
      if (options?.onSuccess) {
        options.onSuccess({
          data: {
            users: [
              {
                id: "user-1",
                employeeId: "EMP001",
                displayName: "テストユーザー1",
              },
              {
                id: "user-2",
                employeeId: "EMP002",
                displayName: "テストユーザー2",
              },
            ],
            total: 2,
          },
        });
      }

      await waitFor(() => {
        expect(screen.getByText("テストユーザー1")).toBeInTheDocument();
        expect(screen.getByText("テストユーザー2")).toBeInTheDocument();
      });
    });

    it("検索結果が0件の場合はメッセージが表示される", async () => {
      const user = userEvent.setup();
      render(<MemberSearchModal {...defaultProps} />);

      const input = screen.getByPlaceholderText("氏名または社員IDで検索...");
      await user.type(input, "存在しない");

      const searchButton = screen.getByText("検索");
      await user.click(searchButton);

      // 成功コールバックをシミュレート（結果0件）
      const options = (globalThis as Record<string, unknown>)
        .__mockActionOptions as {
        onSuccess: (arg: { data: { users: UserDto[]; total: number } }) => void;
      };
      if (options?.onSuccess) {
        options.onSuccess({
          data: {
            users: [],
            total: 0,
          },
        });
      }

      await waitFor(() => {
        expect(
          screen.getByText("該当するユーザーが見つかりません"),
        ).toBeInTheDocument();
      });
    });
  });

  describe("異常系", () => {
    it("除外ユーザーは検索結果に表示されない", async () => {
      const user = userEvent.setup();
      render(
        <MemberSearchModal {...defaultProps} excludeUserIds={["user-1"]} />,
      );

      const input = screen.getByPlaceholderText("氏名または社員IDで検索...");
      await user.type(input, "テスト");

      const searchButton = screen.getByText("検索");
      await user.click(searchButton);

      // 成功コールバックをシミュレート
      const options = (globalThis as Record<string, unknown>)
        .__mockActionOptions as {
        onSuccess: (arg: { data: { users: UserDto[]; total: number } }) => void;
      };
      if (options?.onSuccess) {
        options.onSuccess({
          data: {
            users: [
              {
                id: "user-1",
                employeeId: "EMP001",
                displayName: "除外ユーザー",
              },
              {
                id: "user-2",
                employeeId: "EMP002",
                displayName: "通常ユーザー",
              },
            ],
            total: 2,
          },
        });
      }

      await waitFor(() => {
        // 除外ユーザーは表示されない
        expect(screen.queryByText("除外ユーザー")).not.toBeInTheDocument();
        // 通常ユーザーは表示される
        expect(screen.getByText("通常ユーザー")).toBeInTheDocument();
      });
    });

    it("モーダルが再度開いた時に状態がリセットされる", async () => {
      const { rerender } = render(
        <MemberSearchModal {...defaultProps} isOpen={false} />,
      );

      // モーダルを開く
      rerender(<MemberSearchModal {...defaultProps} isOpen={true} />);

      expect(
        screen.getByPlaceholderText("氏名または社員IDで検索..."),
      ).toHaveValue("");
      expect(screen.getByText("0名")).toBeInTheDocument();
    });
  });
});
