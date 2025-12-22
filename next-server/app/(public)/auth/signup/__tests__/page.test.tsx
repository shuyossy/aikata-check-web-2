import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SignUpPage from "../page";
import { showError, showSuccess } from "@/lib/client/toast";

// onSuccessとonErrorのコールバックを保持する変数
let capturedCallbacks: {
  onSuccess?: (result: unknown) => void;
  onError?: (error: unknown) => void;
} = {};

// next-safe-action/hooks のモック
const mockExecute = vi.fn();
const mockIsPending = vi.fn(() => false);
vi.mock("next-safe-action/hooks", () => ({
  useAction: (
    _action: unknown,
    callbacks: { onSuccess?: (result: unknown) => void; onError?: (error: unknown) => void },
  ) => {
    // コールバックを保存してテストから呼び出せるようにする
    capturedCallbacks = callbacks;
    return {
      execute: mockExecute,
      isPending: mockIsPending(),
    };
  },
}));

// next/navigation のモック
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// toast のモック
vi.mock("@/lib/client/toast", () => ({
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));

// messages のモック
vi.mock("@/lib/client/messages", () => ({
  getMessage: vi.fn().mockImplementation((code) => {
    if (code === "SIGNUP_SUCCESS") return "アカウントを作成しました。サインインしてください。";
    return code;
  }),
}));

describe("SignUpPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPending.mockReturnValue(false);
    capturedCallbacks = {};
  });

  describe("正常系", () => {
    it("AIKATAのロゴとキャッチフレーズが表示される", () => {
      render(<SignUpPage />);
      expect(screen.getByText("AIKATA")).toBeInTheDocument();
      expect(screen.getByText("AIレビュープラットフォーム")).toBeInTheDocument();
    });

    it("アカウント登録のタイトルと説明が表示される", () => {
      render(<SignUpPage />);
      expect(screen.getByText("アカウント登録")).toBeInTheDocument();
      expect(
        screen.getByText("新規アカウントを作成してください"),
      ).toBeInTheDocument();
    });

    it("社員ID入力フィールドが表示される", () => {
      render(<SignUpPage />);
      expect(screen.getByLabelText("社員ID")).toBeInTheDocument();
    });

    it("社員IDのプレースホルダーがPIT*/A*で表示される", () => {
      render(<SignUpPage />);
      expect(screen.getByPlaceholderText("PIT*/A*")).toBeInTheDocument();
    });

    it("名前入力フィールドが表示される", () => {
      render(<SignUpPage />);
      expect(screen.getByLabelText("名前")).toBeInTheDocument();
    });

    it("名前のプレースホルダーが山田太郎で表示される", () => {
      render(<SignUpPage />);
      expect(screen.getByPlaceholderText("山田太郎")).toBeInTheDocument();
    });

    it("パスワード入力フィールドが表示される", () => {
      render(<SignUpPage />);
      expect(screen.getByLabelText("パスワード")).toBeInTheDocument();
    });

    it("パスワード確認入力フィールドが表示される", () => {
      render(<SignUpPage />);
      expect(screen.getByLabelText("パスワード（確認）")).toBeInTheDocument();
    });

    it("登録ボタンが表示される", () => {
      render(<SignUpPage />);
      expect(
        screen.getByRole("button", { name: "登録" }),
      ).toBeInTheDocument();
    });

    it("ログインリンクが表示される", () => {
      render(<SignUpPage />);
      expect(screen.getByText("ログイン")).toBeInTheDocument();
      expect(screen.getByText("ログイン")).toHaveAttribute(
        "href",
        "/auth/signin",
      );
    });

    it("入力が空の場合、登録ボタンが無効になる", () => {
      render(<SignUpPage />);
      const submitButton = screen.getByRole("button", { name: "登録" });
      expect(submitButton).toBeDisabled();
    });

    it("全てのフィールドを入力すると登録ボタンが有効になる", async () => {
      const user = userEvent.setup();
      render(<SignUpPage />);

      const employeeIdInput = screen.getByLabelText("社員ID");
      const displayNameInput = screen.getByLabelText("名前");
      const passwordInput = screen.getByLabelText("パスワード");
      const confirmPasswordInput = screen.getByLabelText("パスワード（確認）");
      const submitButton = screen.getByRole("button", { name: "登録" });

      await user.type(employeeIdInput, "PIT001");
      await user.type(displayNameInput, "山田太郎");
      await user.type(passwordInput, "password123");
      await user.type(confirmPasswordInput, "password123");

      expect(submitButton).not.toBeDisabled();
    });

    it("フォーム送信時にsignupActionが正しい引数で呼ばれる", async () => {
      const user = userEvent.setup();
      render(<SignUpPage />);

      const employeeIdInput = screen.getByLabelText("社員ID");
      const displayNameInput = screen.getByLabelText("名前");
      const passwordInput = screen.getByLabelText("パスワード");
      const confirmPasswordInput = screen.getByLabelText("パスワード（確認）");
      const submitButton = screen.getByRole("button", { name: "登録" });

      await user.type(employeeIdInput, "PIT001");
      await user.type(displayNameInput, "山田太郎");
      await user.type(passwordInput, "password123");
      await user.type(confirmPasswordInput, "password123");
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith({
          employeeId: "PIT001",
          displayName: "山田太郎",
          password: "password123",
        });
      });
    });
  });

  describe("異常系", () => {
    it("パスワードが一致しない場合はエラーメッセージが表示される", async () => {
      const user = userEvent.setup();
      render(<SignUpPage />);

      const employeeIdInput = screen.getByLabelText("社員ID");
      const displayNameInput = screen.getByLabelText("名前");
      const passwordInput = screen.getByLabelText("パスワード");
      const confirmPasswordInput = screen.getByLabelText("パスワード（確認）");
      const submitButton = screen.getByRole("button", { name: "登録" });

      await user.type(employeeIdInput, "PIT001");
      await user.type(displayNameInput, "山田太郎");
      await user.type(passwordInput, "password123");
      await user.type(confirmPasswordInput, "differentpassword");
      await user.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText("パスワードが一致しません"),
        ).toBeInTheDocument();
      });

      // アクションは呼ばれない
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it("登録処理中はローディング状態が表示される", async () => {
      mockIsPending.mockReturnValue(true);
      render(<SignUpPage />);

      expect(screen.getByText("登録中...")).toBeInTheDocument();
    });

    it("登録処理中は入力フィールドが無効になる", async () => {
      mockIsPending.mockReturnValue(true);
      render(<SignUpPage />);

      expect(screen.getByLabelText("社員ID")).toBeDisabled();
      expect(screen.getByLabelText("名前")).toBeDisabled();
      expect(screen.getByLabelText("パスワード")).toBeDisabled();
      expect(screen.getByLabelText("パスワード（確認）")).toBeDisabled();
    });

    it("サーバーエラー（メッセージあり）の場合はエラーメッセージがtoast表示される", async () => {
      const user = userEvent.setup();
      render(<SignUpPage />);

      const employeeIdInput = screen.getByLabelText("社員ID");
      const displayNameInput = screen.getByLabelText("名前");
      const passwordInput = screen.getByLabelText("パスワード");
      const confirmPasswordInput = screen.getByLabelText("パスワード（確認）");
      const submitButton = screen.getByRole("button", { name: "登録" });

      await user.type(employeeIdInput, "PIT001");
      await user.type(displayNameInput, "山田太郎");
      await user.type(passwordInput, "password123");
      await user.type(confirmPasswordInput, "password123");
      await user.click(submitButton);

      // onErrorコールバックを呼び出す
      capturedCallbacks.onError?.({
        error: { serverError: { message: "この社員IDは既に登録されています" } },
      });

      await waitFor(() => {
        expect(showError).toHaveBeenCalledWith(
          "この社員IDは既に登録されています",
        );
      });
    });

    it("サーバーエラー（メッセージなし）の場合は汎用エラーメッセージがtoast表示される", async () => {
      const user = userEvent.setup();
      render(<SignUpPage />);

      const employeeIdInput = screen.getByLabelText("社員ID");
      const displayNameInput = screen.getByLabelText("名前");
      const passwordInput = screen.getByLabelText("パスワード");
      const confirmPasswordInput = screen.getByLabelText("パスワード（確認）");
      const submitButton = screen.getByRole("button", { name: "登録" });

      await user.type(employeeIdInput, "PIT001");
      await user.type(displayNameInput, "山田太郎");
      await user.type(passwordInput, "password123");
      await user.type(confirmPasswordInput, "password123");
      await user.click(submitButton);

      // serverErrorはあるがmessageがない場合
      capturedCallbacks.onError?.({
        error: { serverError: {} },
      });

      await waitFor(() => {
        expect(showError).toHaveBeenCalledWith("登録に失敗しました");
      });
    });

    it("サーバーエラー（serverErrorなし）の場合は汎用エラーメッセージがtoast表示される", async () => {
      const user = userEvent.setup();
      render(<SignUpPage />);

      const employeeIdInput = screen.getByLabelText("社員ID");
      const displayNameInput = screen.getByLabelText("名前");
      const passwordInput = screen.getByLabelText("パスワード");
      const confirmPasswordInput = screen.getByLabelText("パスワード（確認）");
      const submitButton = screen.getByRole("button", { name: "登録" });

      await user.type(employeeIdInput, "PIT001");
      await user.type(displayNameInput, "山田太郎");
      await user.type(passwordInput, "password123");
      await user.type(confirmPasswordInput, "password123");
      await user.click(submitButton);

      // serverErrorがない場合
      capturedCallbacks.onError?.({
        error: {},
      });

      await waitFor(() => {
        expect(showError).toHaveBeenCalledWith("登録に失敗しました");
      });
    });

    it("登録成功時にサインイン画面へリダイレクトされる", async () => {
      const user = userEvent.setup();
      render(<SignUpPage />);

      const employeeIdInput = screen.getByLabelText("社員ID");
      const displayNameInput = screen.getByLabelText("名前");
      const passwordInput = screen.getByLabelText("パスワード");
      const confirmPasswordInput = screen.getByLabelText("パスワード（確認）");
      const submitButton = screen.getByRole("button", { name: "登録" });

      await user.type(employeeIdInput, "PIT001");
      await user.type(displayNameInput, "山田太郎");
      await user.type(passwordInput, "password123");
      await user.type(confirmPasswordInput, "password123");
      await user.click(submitButton);

      // onSuccessコールバックを呼び出す
      capturedCallbacks.onSuccess?.({
        data: { success: true, messageCode: "SIGNUP_SUCCESS" },
      });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/auth/signin");
      });
    });

    it("登録成功時にtoastで成功メッセージが表示される", async () => {
      const user = userEvent.setup();
      render(<SignUpPage />);

      const employeeIdInput = screen.getByLabelText("社員ID");
      const displayNameInput = screen.getByLabelText("名前");
      const passwordInput = screen.getByLabelText("パスワード");
      const confirmPasswordInput = screen.getByLabelText("パスワード（確認）");
      const submitButton = screen.getByRole("button", { name: "登録" });

      await user.type(employeeIdInput, "PIT001");
      await user.type(displayNameInput, "山田太郎");
      await user.type(passwordInput, "password123");
      await user.type(confirmPasswordInput, "password123");
      await user.click(submitButton);

      // onSuccessコールバックを呼び出す
      capturedCallbacks.onSuccess?.({
        data: { success: true, messageCode: "SIGNUP_SUCCESS" },
      });

      await waitFor(() => {
        expect(showSuccess).toHaveBeenCalledWith(
          "アカウントを作成しました。サインインしてください。",
        );
      });
    });
  });
});
