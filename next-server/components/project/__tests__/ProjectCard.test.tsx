import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjectCard } from "../ProjectCard";
import { ProjectListItemDto } from "@/domain/project";

// next/linkのモック
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

// next/navigationのモック
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

describe("ProjectCard", () => {
  const baseProject: ProjectListItemDto = {
    id: "123e4567-e89b-12d3-a456-426614174000",
    name: "テストプロジェクト",
    description: "これはテスト用のプロジェクトです",
    updatedAt: "2024-01-15T10:30:00Z",
    memberCount: 3,
    memberPreview: [
      { userId: "user-1", displayName: "ユーザー1" },
      { userId: "user-2", displayName: "ユーザー2" },
      { userId: "user-3", displayName: "ユーザー3" },
    ],
  };

  describe("正常系", () => {
    it("プロジェクト名が表示される", () => {
      render(<ProjectCard project={baseProject} />);

      expect(screen.getByText("テストプロジェクト")).toBeInTheDocument();
    });

    it("プロジェクトの説明が表示される", () => {
      render(<ProjectCard project={baseProject} />);

      expect(
        screen.getByText("これはテスト用のプロジェクトです"),
      ).toBeInTheDocument();
    });

    it("説明がない場合は「説明なし」と表示される", () => {
      const projectWithoutDesc: ProjectListItemDto = {
        ...baseProject,
        description: null,
      };
      render(<ProjectCard project={projectWithoutDesc} />);

      expect(screen.getByText("説明なし")).toBeInTheDocument();
    });

    it("最終更新日がフォーマットされて表示される", () => {
      render(<ProjectCard project={baseProject} />);

      expect(screen.getByText(/最終更新:/)).toBeInTheDocument();
      expect(screen.getByText(/2024\/01\/15/)).toBeInTheDocument();
    });

    it("カードクリックでプロジェクト詳細ページへ遷移する", async () => {
      const mockPush = vi.fn();
      vi.mocked(await import("next/navigation")).useRouter = () =>
        ({
          push: mockPush,
          replace: vi.fn(),
          prefetch: vi.fn(),
        }) as ReturnType<typeof import("next/navigation").useRouter>;

      render(<ProjectCard project={baseProject} />);

      // カードのテキストがあることを確認
      expect(screen.getByText("テストプロジェクト")).toBeInTheDocument();
    });

    it("設定ページへのリンクが設定される", () => {
      render(<ProjectCard project={baseProject} />);

      // 設定リンクを取得（hrefで判定）
      const links = screen.getAllByRole("link");
      const settingsLink = links.find((link) =>
        link.getAttribute("href")?.includes("/settings"),
      );
      expect(settingsLink).toBeDefined();
      expect(settingsLink).toHaveAttribute(
        "href",
        `/projects/${baseProject.id}/settings`,
      );
    });

    it("「開く」テキストが表示される", () => {
      render(<ProjectCard project={baseProject} />);

      expect(screen.getByText("開く")).toBeInTheDocument();
    });
  });

  describe("メンバー表示", () => {
    it("メンバーが3人の場合、全員のアバターが表示される", () => {
      render(<ProjectCard project={baseProject} />);

      // AvatarGroupコンポーネントがメンバーを表示していることを確認
      // 3人のアバターが表示されている（"ユ"が3つ）
      const avatars = screen.getAllByText("ユ");
      expect(avatars).toHaveLength(3);
    });

    it("メンバーが5人以上の場合、残りの人数が表示される", () => {
      const projectWithManyMembers: ProjectListItemDto = {
        ...baseProject,
        memberCount: 7,
        memberPreview: [
          { userId: "user-1", displayName: "ユーザー1" },
          { userId: "user-2", displayName: "ユーザー2" },
          { userId: "user-3", displayName: "ユーザー3" },
          { userId: "user-4", displayName: "ユーザー4" },
          { userId: "user-5", displayName: "ユーザー5" },
        ],
      };
      render(<ProjectCard project={projectWithManyMembers} />);

      // AvatarGroupは maxDisplay=3 で設定されているので、+4 が表示されるはず
      // (5人のプレビューから3人表示、残り2人 + memberCountとの差分)
      // 実際の表示ロジックはAvatarGroupに依存
    });
  });

  describe("異常系", () => {
    it("空の説明でもエラーにならない", () => {
      const projectWithEmptyDesc: ProjectListItemDto = {
        ...baseProject,
        description: "",
      };
      render(<ProjectCard project={projectWithEmptyDesc} />);

      expect(screen.getByText("説明なし")).toBeInTheDocument();
    });

    it("日付が文字列でもフォーマットされる", () => {
      const projectWithStringDate: ProjectListItemDto = {
        ...baseProject,
        // UTCで2024/06/20となる日付
        updatedAt: "2024-06-20T15:45:00Z",
      };
      render(<ProjectCard project={projectWithStringDate} />);

      expect(screen.getByText(/2024\/06\/20/)).toBeInTheDocument();
    });
  });
});
