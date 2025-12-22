import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SignInPage from "../page";

// next-auth/react のモック
const mockSignIn = vi.fn();
vi.mock("next-auth/react", () => ({
  signIn: (provider: string, options: { callbackUrl: string }) =>
    mockSignIn(provider, options),
}));

// next/navigation のモック
const mockGet = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: mockGet,
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

  describe("正常系", () => {
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
      expect(screen.getByText("ログイン")).toBeInTheDocument();
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

  describe("異常系", () => {
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
});
