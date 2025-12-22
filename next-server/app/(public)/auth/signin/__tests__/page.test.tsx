import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SignInPage from "../page";

// next-auth/react のモック
const mockSignIn = vi.fn();
vi.mock("next-auth/react", () => ({
  signIn: (
    provider: string,
    options: { callbackUrl?: string; redirect?: boolean },
  ) => mockSignIn(provider, options),
}));

// next/navigation のモック
const mockGet = vi.fn();
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: mockGet,
  }),
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe("SignInPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // デフォルトのモック設定
    mockGet.mockImplementation((key: string) => {
      if (key === "callbackUrl") return "/dashboard";
      if (key === "error") return null;
      return null;
    });
  });

  describe("正常系 - SSO認証", () => {
    it("Keycloakログインボタンが表示される", () => {
      render(<SignInPage />);
      expect(screen.getByText("Keycloakでログイン")).toBeInTheDocument();
    });

    it("GitLabログインボタンが表示される", () => {
      render(<SignInPage />);
      expect(screen.getByText("GitLabでログイン")).toBeInTheDocument();
    });

    it("AIKATAのロゴとキャッチフレーズが表示される", () => {
      render(<SignInPage />);
      expect(screen.getByText("AIKATA")).toBeInTheDocument();
      expect(screen.getByText("AIレビュープラットフォーム")).toBeInTheDocument();
    });

    it("ログインカードのタイトルと説明が表示される", () => {
      render(<SignInPage />);
      expect(
        screen.getByRole("heading", { name: "ログイン" }),
      ).toBeInTheDocument();
      expect(
        screen.getByText("アカウントにログインしてください"),
      ).toBeInTheDocument();
    });

    it("KeycloakログインボタンをクリックするとsignIn('keycloak')が呼ばれる", () => {
      render(<SignInPage />);

      const keycloakButton = screen.getByText("Keycloakでログイン");
      fireEvent.click(keycloakButton);

      expect(mockSignIn).toHaveBeenCalledWith("keycloak", {
        callbackUrl: "/dashboard",
      });
    });

    it("GitLabログインボタンをクリックするとsignIn('gitlab')が呼ばれる", () => {
      render(<SignInPage />);

      const gitlabButton = screen.getByText("GitLabでログイン");
      fireEvent.click(gitlabButton);

      expect(mockSignIn).toHaveBeenCalledWith("gitlab", {
        callbackUrl: "/dashboard",
      });
    });

    it("callbackUrlパラメータが指定されていない場合はルートがデフォルトになる", () => {
      mockGet.mockImplementation((key: string) => {
        if (key === "callbackUrl") return null;
        if (key === "error") return null;
        return null;
      });

      render(<SignInPage />);

      const keycloakButton = screen.getByText("Keycloakでログイン");
      fireEvent.click(keycloakButton);

      expect(mockSignIn).toHaveBeenCalledWith("keycloak", {
        callbackUrl: "/",
      });
    });
  });

  describe("正常系 - 独自認証", () => {
    it("社員ID入力フィールドが表示される", () => {
      render(<SignInPage />);
      expect(screen.getByLabelText("社員ID")).toBeInTheDocument();
    });

    it("パスワード入力フィールドが表示される", () => {
      render(<SignInPage />);
      expect(screen.getByLabelText("パスワード")).toBeInTheDocument();
    });

    it("ログインボタンが表示される", () => {
      render(<SignInPage />);
      expect(
        screen.getByRole("button", { name: "ログイン" }),
      ).toBeInTheDocument();
    });

    it("新規登録リンクが表示される", () => {
      render(<SignInPage />);
      expect(screen.getByText("新規登録")).toBeInTheDocument();
      expect(screen.getByText("新規登録")).toHaveAttribute(
        "href",
        "/auth/signup",
      );
    });

    it("社員IDのプレースホルダーがPIT*/A*で表示される", () => {
      render(<SignInPage />);
      expect(screen.getByPlaceholderText("PIT*/A*")).toBeInTheDocument();
    });

    it("入力が空の場合、ログインボタンが無効になる", () => {
      render(<SignInPage />);
      const loginButton = screen.getByRole("button", { name: "ログイン" });
      expect(loginButton).toBeDisabled();
    });

    it("社員IDとパスワードを入力するとログインボタンが有効になる", async () => {
      const user = userEvent.setup();
      render(<SignInPage />);

      const employeeIdInput = screen.getByLabelText("社員ID");
      const passwordInput = screen.getByLabelText("パスワード");
      const loginButton = screen.getByRole("button", { name: "ログイン" });

      await user.type(employeeIdInput, "PIT001");
      await user.type(passwordInput, "password123");

      expect(loginButton).not.toBeDisabled();
    });

    it("ログインフォーム送信時にsignIn('credentials')が呼ばれる", async () => {
      const user = userEvent.setup();
      mockSignIn.mockResolvedValue({ ok: true, error: null });
      render(<SignInPage />);

      const employeeIdInput = screen.getByLabelText("社員ID");
      const passwordInput = screen.getByLabelText("パスワード");
      const loginButton = screen.getByRole("button", { name: "ログイン" });

      await user.type(employeeIdInput, "PIT001");
      await user.type(passwordInput, "password123");
      await user.click(loginButton);

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith("credentials", {
          employeeId: "PIT001",
          password: "password123",
          redirect: false,
        });
      });
    });

    it("ログイン成功時にcallbackUrlにリダイレクトされる", async () => {
      const user = userEvent.setup();
      mockSignIn.mockResolvedValue({ ok: true, error: null });
      render(<SignInPage />);

      const employeeIdInput = screen.getByLabelText("社員ID");
      const passwordInput = screen.getByLabelText("パスワード");
      const loginButton = screen.getByRole("button", { name: "ログイン" });

      await user.type(employeeIdInput, "PIT001");
      await user.type(passwordInput, "password123");
      await user.click(loginButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/dashboard");
      });
    });
  });

  describe("異常系 - SSO認証", () => {
    it("UserSyncFailedエラー時にエラーメッセージが表示される", () => {
      mockGet.mockImplementation((key: string) => {
        if (key === "error") return "UserSyncFailed";
        if (key === "callbackUrl") return "/dashboard";
        return null;
      });

      render(<SignInPage />);
      expect(
        screen.getByText(
          "システムに問題が発生しており、ログイン処理を完了できません",
        ),
      ).toBeInTheDocument();
    });

    it("OAuthCallbackエラー時に汎用エラーメッセージが表示される", () => {
      mockGet.mockImplementation((key: string) => {
        if (key === "error") return "OAuthCallback";
        if (key === "callbackUrl") return "/dashboard";
        return null;
      });

      render(<SignInPage />);
      expect(screen.getByText("ログインに失敗しました")).toBeInTheDocument();
    });

    it("その他のエラー時に汎用エラーメッセージが表示される", () => {
      mockGet.mockImplementation((key: string) => {
        if (key === "error") return "UnknownError";
        if (key === "callbackUrl") return "/dashboard";
        return null;
      });

      render(<SignInPage />);
      expect(screen.getByText("ログインに失敗しました")).toBeInTheDocument();
    });

    it("エラーがない場合はエラーメッセージが表示されない", () => {
      mockGet.mockImplementation((key: string) => {
        if (key === "error") return null;
        if (key === "callbackUrl") return "/dashboard";
        return null;
      });

      render(<SignInPage />);
      expect(
        screen.queryByText(
          "システムに問題が発生しており、ログイン処理を完了できません",
        ),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("ログインに失敗しました"),
      ).not.toBeInTheDocument();
    });
  });

  describe("異常系 - 独自認証", () => {
    it("CredentialsSigninエラー時に認証エラーメッセージが表示される", () => {
      mockGet.mockImplementation((key: string) => {
        if (key === "error") return "CredentialsSignin";
        if (key === "callbackUrl") return "/dashboard";
        return null;
      });

      render(<SignInPage />);
      expect(
        screen.getByText("社員IDまたはパスワードが正しくありません"),
      ).toBeInTheDocument();
    });

    it("認証失敗時にエラーメッセージが表示される", async () => {
      const user = userEvent.setup();
      mockSignIn.mockResolvedValue({ ok: false, error: "CredentialsSignin" });
      render(<SignInPage />);

      const employeeIdInput = screen.getByLabelText("社員ID");
      const passwordInput = screen.getByLabelText("パスワード");
      const loginButton = screen.getByRole("button", { name: "ログイン" });

      await user.type(employeeIdInput, "PIT001");
      await user.type(passwordInput, "wrongpassword");
      await user.click(loginButton);

      await waitFor(() => {
        expect(
          screen.getByText("社員IDまたはパスワードが正しくありません"),
        ).toBeInTheDocument();
      });
    });

    it("ログイン処理中はローディング状態が表示される", async () => {
      const user = userEvent.setup();
      // signInが解決されないようにする
      mockSignIn.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000)),
      );
      render(<SignInPage />);

      const employeeIdInput = screen.getByLabelText("社員ID");
      const passwordInput = screen.getByLabelText("パスワード");
      const loginButton = screen.getByRole("button", { name: "ログイン" });

      await user.type(employeeIdInput, "PIT001");
      await user.type(passwordInput, "password123");
      await user.click(loginButton);

      expect(screen.getByText("ログイン中...")).toBeInTheDocument();
    });

    it("ログイン処理中は入力フィールドが無効になる", async () => {
      const user = userEvent.setup();
      mockSignIn.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000)),
      );
      render(<SignInPage />);

      const employeeIdInput = screen.getByLabelText("社員ID");
      const passwordInput = screen.getByLabelText("パスワード");
      const loginButton = screen.getByRole("button", { name: "ログイン" });

      await user.type(employeeIdInput, "PIT001");
      await user.type(passwordInput, "password123");
      await user.click(loginButton);

      expect(employeeIdInput).toBeDisabled();
      expect(passwordInput).toBeDisabled();
    });

    it("ログイン処理中に例外が発生した場合はエラーメッセージが表示される", async () => {
      const user = userEvent.setup();
      mockSignIn.mockRejectedValue(new Error("Network error"));
      render(<SignInPage />);

      const employeeIdInput = screen.getByLabelText("社員ID");
      const passwordInput = screen.getByLabelText("パスワード");
      const loginButton = screen.getByRole("button", { name: "ログイン" });

      await user.type(employeeIdInput, "PIT001");
      await user.type(passwordInput, "password123");
      await user.click(loginButton);

      await waitFor(() => {
        expect(
          screen.getByText("ログイン処理中にエラーが発生しました"),
        ).toBeInTheDocument();
      });
    });

    it("例外発生後にローディング状態が解除される", async () => {
      const user = userEvent.setup();
      mockSignIn.mockRejectedValue(new Error("Network error"));
      render(<SignInPage />);

      const employeeIdInput = screen.getByLabelText("社員ID");
      const passwordInput = screen.getByLabelText("パスワード");
      const loginButton = screen.getByRole("button", { name: "ログイン" });

      await user.type(employeeIdInput, "PIT001");
      await user.type(passwordInput, "password123");
      await user.click(loginButton);

      await waitFor(() => {
        expect(employeeIdInput).not.toBeDisabled();
        expect(passwordInput).not.toBeDisabled();
        expect(screen.queryByText("ログイン中...")).not.toBeInTheDocument();
      });
    });
  });
});
