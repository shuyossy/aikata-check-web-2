import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectForm, ProjectFormData } from "../ProjectForm";
import { UserDto } from "@/domain/user";

// next-safe-actionのモック
vi.mock("next-safe-action/hooks", () => ({
  useAction: vi.fn(() => ({
    execute: vi.fn(),
    isPending: false,
  })),
}));

// searchUsersActionのモック
vi.mock("@/app/projects/actions", () => ({
  searchUsersAction: vi.fn(),
}));

describe("ProjectForm", () => {
  const currentUser: UserDto = {
    id: "current-user-id",
    employeeId: "EMP001",
    displayName: "現在のユーザー",
  };

  const defaultProps = {
    currentUser,
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系", () => {
    it("フォームが正しくレンダリングされる", () => {
      render(<ProjectForm {...defaultProps} />);

      expect(screen.getByText("基本情報")).toBeInTheDocument();
      expect(screen.getByText("API設定")).toBeInTheDocument();
      expect(screen.getByText("メンバー")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("例: ○○システム開発プロジェクト"),
      ).toBeInTheDocument();
    });

    it("初期値が正しく設定される", () => {
      const initialData: Partial<ProjectFormData> = {
        name: "テストプロジェクト",
        description: "テストの説明",
        apiKey: "sk-test",
        members: [currentUser],
      };

      render(<ProjectForm {...defaultProps} initialData={initialData} />);

      expect(
        screen.getByDisplayValue("テストプロジェクト"),
      ).toBeInTheDocument();
      expect(screen.getByDisplayValue("テストの説明")).toBeInTheDocument();
    });

    it("送信ボタンのラベルをカスタマイズできる", () => {
      render(<ProjectForm {...defaultProps} submitLabel="変更を保存" />);

      expect(screen.getByText("変更を保存")).toBeInTheDocument();
    });

    it("isSubmittingがtrueの場合は「処理中...」が表示される", () => {
      render(<ProjectForm {...defaultProps} isSubmitting={true} />);

      expect(screen.getByText("処理中...")).toBeInTheDocument();
    });

    it("プロジェクト名を入力できる", async () => {
      const user = userEvent.setup();
      render(<ProjectForm {...defaultProps} />);

      const input =
        screen.getByPlaceholderText("例: ○○システム開発プロジェクト");
      await user.type(input, "新しいプロジェクト");

      expect(input).toHaveValue("新しいプロジェクト");
    });

    it("説明を入力できる", async () => {
      const user = userEvent.setup();
      render(<ProjectForm {...defaultProps} />);

      const textarea = screen.getByPlaceholderText(
        "プロジェクトの目的や概要を入力してください",
      );
      await user.type(textarea, "プロジェクトの説明です");

      expect(textarea).toHaveValue("プロジェクトの説明です");
    });

    it("APIキーを入力できる", async () => {
      const user = userEvent.setup();
      render(<ProjectForm {...defaultProps} />);

      const input = screen.getByPlaceholderText("sk-xxxxxxxxxxxxxxxxxxxx");
      await user.type(input, "sk-test123");

      expect(input).toHaveValue("sk-test123");
    });

    it("APIキーの表示/非表示を切り替えられる", async () => {
      const user = userEvent.setup();
      render(<ProjectForm {...defaultProps} />);

      const input = screen.getByPlaceholderText("sk-xxxxxxxxxxxxxxxxxxxx");
      expect(input).toHaveAttribute("type", "password");

      // 表示ボタンをクリック
      const toggleButton = input.parentElement?.querySelector("button");
      if (toggleButton) {
        await user.click(toggleButton);
        expect(input).toHaveAttribute("type", "text");
      }
    });
  });

  describe("バリデーション", () => {
    it("プロジェクト名が空の場合はエラーが表示される", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      render(<ProjectForm {...defaultProps} onSubmit={onSubmit} />);

      const submitButton = screen.getByText("プロジェクトを作成");
      await user.click(submitButton);

      expect(screen.getByText("プロジェクト名は必須です")).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("正しい入力でフォームを送信できる", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      render(<ProjectForm {...defaultProps} onSubmit={onSubmit} />);

      const nameInput =
        screen.getByPlaceholderText("例: ○○システム開発プロジェクト");
      await user.type(nameInput, "テストプロジェクト");

      const submitButton = screen.getByText("プロジェクトを作成");
      await user.click(submitButton);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({
          name: "テストプロジェクト",
          description: "",
          apiKey: null, // APIキーは変更されていないのでnull
          members: [currentUser],
        });
      });
    });
  });

  describe("キャンセル", () => {
    it("キャンセルボタンをクリックするとonCancelが呼ばれる", async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      render(<ProjectForm {...defaultProps} onCancel={onCancel} />);

      const cancelButton = screen.getByText("キャンセル");
      await user.click(cancelButton);

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("送信中はキャンセルボタンが無効になる", () => {
      render(<ProjectForm {...defaultProps} isSubmitting={true} />);

      const cancelButton = screen.getByText("キャンセル");
      expect(cancelButton).toBeDisabled();
    });
  });

  describe("メンバー管理", () => {
    it("現在のユーザーがデフォルトでメンバーに含まれる", () => {
      render(<ProjectForm {...defaultProps} />);

      expect(screen.getByText("現在のユーザー")).toBeInTheDocument();
    });

    it("メンバーを追加ボタンが表示される", () => {
      render(<ProjectForm {...defaultProps} />);

      expect(screen.getByText("メンバーを追加")).toBeInTheDocument();
    });

    it("メンバーが自分のみの場合、空状態メッセージが表示される", () => {
      render(<ProjectForm {...defaultProps} />);

      expect(
        screen.getByText("「メンバーを追加」ボタンから追加できます"),
      ).toBeInTheDocument();
    });
  });

  describe("API設定セクション", () => {
    describe("新規作成モード（hasApiKey未指定）", () => {
      it("「設定済み」バッジが表示されない", () => {
        render(<ProjectForm {...defaultProps} />);

        expect(screen.queryByText("（設定済み）")).not.toBeInTheDocument();
      });

      it("プレースホルダーが「sk-xxxx...」形式で表示される", () => {
        render(<ProjectForm {...defaultProps} />);

        const apiKeyInput = screen.getByPlaceholderText("sk-xxxxxxxxxxxxxxxxxxxx");
        expect(apiKeyInput).toBeInTheDocument();
      });

      it("APIキーを入力して送信すると値が渡される", async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn();
        render(<ProjectForm {...defaultProps} onSubmit={onSubmit} />);

        // プロジェクト名を入力（必須フィールド）
        const nameInput = screen.getByPlaceholderText(
          "例: ○○システム開発プロジェクト",
        );
        await user.type(nameInput, "テストプロジェクト");

        // APIキーを入力
        const apiKeyInput = screen.getByPlaceholderText("sk-xxxxxxxxxxxxxxxxxxxx");
        await user.type(apiKeyInput, "sk-test-key");

        // 送信
        const submitButton = screen.getByText("プロジェクトを作成");
        await user.click(submitButton);

        await waitFor(() => {
          expect(onSubmit).toHaveBeenCalledWith(
            expect.objectContaining({
              apiKey: "sk-test-key",
            }),
          );
        });
      });
    });

    describe("編集モード（hasApiKey=true）", () => {
      const initialDataWithApiKey: Partial<ProjectFormData> & {
        hasApiKey: boolean;
      } = {
        name: "既存プロジェクト",
        description: "説明",
        apiKey: "", // APIキーの実際の値は渡さない
        members: [currentUser],
        hasApiKey: true,
      };

      it("「設定済み」バッジが表示される", () => {
        render(
          <ProjectForm {...defaultProps} initialData={initialDataWithApiKey} />,
        );

        expect(screen.getByText("（設定済み）")).toBeInTheDocument();
      });

      it("プレースホルダーが「新しいAPIキーを入力すると上書きされます」と表示される", () => {
        render(
          <ProjectForm {...defaultProps} initialData={initialDataWithApiKey} />,
        );

        const apiKeyInput = screen.getByPlaceholderText(
          "新しいAPIキーを入力すると上書きされます",
        );
        expect(apiKeyInput).toBeInTheDocument();
      });

      it("APIキーを変更せずに送信するとapiKeyがnullで渡される", async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn();
        render(
          <ProjectForm
            {...defaultProps}
            initialData={initialDataWithApiKey}
            onSubmit={onSubmit}
          />,
        );

        // 送信（APIキーは変更しない）
        const submitButton = screen.getByText("プロジェクトを作成");
        await user.click(submitButton);

        await waitFor(() => {
          expect(onSubmit).toHaveBeenCalledWith(
            expect.objectContaining({
              apiKey: null, // 変更されていないのでnull
            }),
          );
        });
      });

      it("APIキーを変更して送信すると新しい値が渡される", async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn();
        render(
          <ProjectForm
            {...defaultProps}
            initialData={initialDataWithApiKey}
            onSubmit={onSubmit}
          />,
        );

        // 新しいAPIキーを入力
        const apiKeyInput = screen.getByPlaceholderText(
          "新しいAPIキーを入力すると上書きされます",
        );
        await user.type(apiKeyInput, "sk-new-key");

        // 送信
        const submitButton = screen.getByText("プロジェクトを作成");
        await user.click(submitButton);

        await waitFor(() => {
          expect(onSubmit).toHaveBeenCalledWith(
            expect.objectContaining({
              apiKey: "sk-new-key",
            }),
          );
        });
      });

      it("APIキーを入力後、空にして送信するとapiKeyがnullで渡される", async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn();
        render(
          <ProjectForm
            {...defaultProps}
            initialData={initialDataWithApiKey}
            onSubmit={onSubmit}
          />,
        );

        const apiKeyInput = screen.getByPlaceholderText(
          "新しいAPIキーを入力すると上書きされます",
        );
        // 入力して
        await user.type(apiKeyInput, "temp");
        // クリア
        await user.clear(apiKeyInput);

        // 送信
        const submitButton = screen.getByText("プロジェクトを作成");
        await user.click(submitButton);

        await waitFor(() => {
          // 空文字で変更されたが、空なのでnullとして扱う
          expect(onSubmit).toHaveBeenCalledWith(
            expect.objectContaining({
              apiKey: null,
            }),
          );
        });
      });
    });

    describe("編集モード（hasApiKey=false）", () => {
      const initialDataWithoutApiKey: Partial<ProjectFormData> & {
        hasApiKey: boolean;
      } = {
        name: "既存プロジェクト",
        description: "説明",
        apiKey: "",
        members: [currentUser],
        hasApiKey: false,
      };

      it("「設定済み」バッジが表示されない", () => {
        render(
          <ProjectForm
            {...defaultProps}
            initialData={initialDataWithoutApiKey}
          />,
        );

        expect(screen.queryByText("（設定済み）")).not.toBeInTheDocument();
      });

      it("プレースホルダーが「sk-xxxx...」形式で表示される", () => {
        render(
          <ProjectForm
            {...defaultProps}
            initialData={initialDataWithoutApiKey}
          />,
        );

        const apiKeyInput = screen.getByPlaceholderText("sk-xxxxxxxxxxxxxxxxxxxx");
        expect(apiKeyInput).toBeInTheDocument();
      });
    });
  });

  describe("異常系", () => {
    it("説明が1000文字を超えるとエラーが表示される", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      render(<ProjectForm {...defaultProps} onSubmit={onSubmit} />);

      // プロジェクト名を入力
      const nameInput =
        screen.getByPlaceholderText("例: ○○システム開発プロジェクト");
      await user.type(nameInput, "テストプロジェクト");

      // 説明を1001文字以上入力
      const descTextarea = screen.getByPlaceholderText(
        "プロジェクトの目的や概要を入力してください",
      );
      const longDescription = "あ".repeat(1001);
      fireEvent.change(descTextarea, { target: { value: longDescription } });

      const submitButton = screen.getByText("プロジェクトを作成");
      await user.click(submitButton);

      expect(
        screen.getByText("説明は1000文字以内で入力してください"),
      ).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("プロジェクト名が100文字を超えるとエラーが表示される", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      render(<ProjectForm {...defaultProps} onSubmit={onSubmit} />);

      const nameInput =
        screen.getByPlaceholderText("例: ○○システム開発プロジェクト");
      const longName = "あ".repeat(101);
      fireEvent.change(nameInput, { target: { value: longName } });

      const submitButton = screen.getByText("プロジェクトを作成");
      await user.click(submitButton);

      expect(
        screen.getByText("プロジェクト名は100文字以内で入力してください"),
      ).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });
});
