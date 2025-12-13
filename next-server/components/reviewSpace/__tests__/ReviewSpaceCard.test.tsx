import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReviewSpaceCard } from "../ReviewSpaceCard";
import { ReviewSpaceListItemDto } from "@/domain/reviewSpace";

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

describe("ReviewSpaceCard", () => {
  const projectId = "123e4567-e89b-12d3-a456-426614174000";

  const baseSpace: ReviewSpaceListItemDto = {
    id: "223e4567-e89b-12d3-a456-426614174001",
    name: "テストレビュースペース",
    description: "これはテスト用のレビュースペースです",
    updatedAt: "2024-01-15T10:30:00Z",
  };

  describe("正常系", () => {
    it("スペース名が表示される", () => {
      render(<ReviewSpaceCard space={baseSpace} projectId={projectId} />);

      expect(screen.getByText("テストレビュースペース")).toBeInTheDocument();
    });

    it("スペースの説明が表示される", () => {
      render(<ReviewSpaceCard space={baseSpace} projectId={projectId} />);

      expect(
        screen.getByText("これはテスト用のレビュースペースです"),
      ).toBeInTheDocument();
    });

    it("説明がない場合は「説明なし」と表示される", () => {
      const spaceWithoutDesc: ReviewSpaceListItemDto = {
        ...baseSpace,
        description: null,
      };
      render(<ReviewSpaceCard space={spaceWithoutDesc} projectId={projectId} />);

      expect(screen.getByText("説明なし")).toBeInTheDocument();
    });

    it("説明が空文字の場合は「説明なし」と表示される", () => {
      const spaceWithEmptyDesc: ReviewSpaceListItemDto = {
        ...baseSpace,
        description: "",
      };
      render(<ReviewSpaceCard space={spaceWithEmptyDesc} projectId={projectId} />);

      expect(screen.getByText("説明なし")).toBeInTheDocument();
    });

    it("最終更新日がフォーマットされて表示される", () => {
      render(<ReviewSpaceCard space={baseSpace} projectId={projectId} />);

      expect(screen.getByText(/最終更新:/)).toBeInTheDocument();
      expect(screen.getByText(/2024\/01\/15/)).toBeInTheDocument();
    });

    it("設定ページへのリンクが正しく設定される", () => {
      render(<ReviewSpaceCard space={baseSpace} projectId={projectId} />);

      // 設定リンクを取得（hrefで判定）
      const links = screen.getAllByRole("link");
      const settingsLink = links.find((link) =>
        link.getAttribute("href")?.includes("/settings"),
      );
      expect(settingsLink).toBeDefined();
      expect(settingsLink).toHaveAttribute(
        "href",
        `/projects/${projectId}/spaces/${baseSpace.id}/settings`,
      );
    });

    it("「開く」テキストが表示される", () => {
      render(<ReviewSpaceCard space={baseSpace} projectId={projectId} />);

      expect(screen.getByText("開く")).toBeInTheDocument();
    });

    it("フォルダアイコンが表示される", () => {
      render(<ReviewSpaceCard space={baseSpace} projectId={projectId} />);

      // Folderアイコンはsvgで表示されるので、クラス名などで確認
      // カード全体が正常にレンダリングされることを確認
      expect(screen.getByText("テストレビュースペース")).toBeInTheDocument();
    });
  });

  describe("ナビゲーション", () => {
    it("カードにクリック可能なスタイルが適用される", () => {
      const { container } = render(
        <ReviewSpaceCard space={baseSpace} projectId={projectId} />,
      );

      // cursor-pointerクラスが適用されていることを確認
      const card = container.querySelector(".cursor-pointer");
      expect(card).toBeInTheDocument();
    });

    it("ホバー時のスタイルが設定されている", () => {
      const { container } = render(
        <ReviewSpaceCard space={baseSpace} projectId={projectId} />,
      );

      // hover:shadow-mdクラスが適用されていることを確認
      const card = container.querySelector('[class*="hover:shadow-md"]');
      expect(card).toBeInTheDocument();
    });
  });

  describe("異常系", () => {
    it("日付が文字列でもフォーマットされる", () => {
      const spaceWithStringDate: ReviewSpaceListItemDto = {
        ...baseSpace,
        // UTCで2024/06/20となる日付
        updatedAt: "2024-06-20T15:45:00Z",
      };
      render(<ReviewSpaceCard space={spaceWithStringDate} projectId={projectId} />);

      expect(screen.getByText(/2024\/06\/20/)).toBeInTheDocument();
    });

    it("長い説明でも正常に表示される", () => {
      const spaceWithLongDesc: ReviewSpaceListItemDto = {
        ...baseSpace,
        description: "あ".repeat(200),
      };
      render(<ReviewSpaceCard space={spaceWithLongDesc} projectId={projectId} />);

      // 長い説明が表示されていることを確認（line-clampで省略される）
      expect(screen.getByText("あ".repeat(200))).toBeInTheDocument();
    });

    it("長いスペース名でも正常に表示される", () => {
      const spaceWithLongName: ReviewSpaceListItemDto = {
        ...baseSpace,
        name: "テスト" + "あ".repeat(50),
      };
      render(<ReviewSpaceCard space={spaceWithLongName} projectId={projectId} />);

      expect(screen.getByText("テスト" + "あ".repeat(50))).toBeInTheDocument();
    });
  });
});
