import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sidebar } from "../Sidebar";

// next/linkのモック
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

// next/navigationのモック
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/projects/proj-1/spaces/space-1"),
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

describe("Sidebar", () => {
  const defaultProps = {
    currentProject: {
      id: "proj-1",
      name: "テストプロジェクト",
    },
    projects: [{ id: "proj-1", name: "テストプロジェクト" }],
    reviewSpaces: [
      {
        id: "space-1",
        name: "レビュースペース1",
        reviewTargets: [
          {
            id: "target-1",
            name: "レビュー対象1",
            status: "completed" as const,
          },
        ],
        hasMore: false,
      },
      {
        id: "space-2",
        name: "レビュースペース2",
        reviewTargets: [],
        hasMore: false,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("新規レビューリンク", () => {
    describe("正常系", () => {
      it("レビュースペース展開時に新規レビューリンクが表示されること", async () => {
        // 現在のパスに含まれるスペースは初期展開される
        render(<Sidebar {...defaultProps} />);

        // space-1は初期展開されているので、新規レビューリンクが表示される
        expect(screen.getByText("新規レビュー")).toBeInTheDocument();
      });

      it("新規レビューリンクのhref属性が正しく設定されていること", async () => {
        render(<Sidebar {...defaultProps} />);

        const newReviewLink = screen.getByText("新規レビュー").closest("a");
        expect(newReviewLink).toHaveAttribute(
          "href",
          "/projects/proj-1/spaces/space-1/review/new",
        );
      });

      it("別のレビュースペースを展開すると、そのスペースの新規レビューリンクが表示されること", async () => {
        const user = userEvent.setup();
        render(<Sidebar {...defaultProps} />);

        // space-2を展開
        const space2Button = screen.getByText("レビュースペース2");
        await user.click(space2Button);

        // 新規レビューリンクが2つ表示される（space-1とspace-2）
        const newReviewLinks = screen.getAllByText("新規レビュー");
        expect(newReviewLinks.length).toBe(2);

        // space-2の新規レビューリンクが正しいhrefを持つ
        const space2Link = newReviewLinks[1].closest("a");
        expect(space2Link).toHaveAttribute(
          "href",
          "/projects/proj-1/spaces/space-2/review/new",
        );
      });

      it("チェックリストリンクの直後に新規レビューリンクが配置されていること", () => {
        render(<Sidebar {...defaultProps} />);

        // 展開セクション内のリンクを取得
        const checklistLink = screen.getByText("チェックリスト").closest("a");
        const newReviewLink = screen.getByText("新規レビュー").closest("a");

        // 両方のリンクが存在することを確認
        expect(checklistLink).toBeInTheDocument();
        expect(newReviewLink).toBeInTheDocument();

        // DOM順序を確認（チェックリストの次に新規レビュー）
        const parent = checklistLink?.parentElement;
        if (parent) {
          const links = parent.querySelectorAll("a");
          const checklistIndex = Array.from(links).indexOf(
            checklistLink as HTMLAnchorElement,
          );
          const newReviewIndex = Array.from(links).indexOf(
            newReviewLink as HTMLAnchorElement,
          );
          expect(newReviewIndex).toBe(checklistIndex + 1);
        }
      });
    });

    describe("異常系", () => {
      it("レビュースペースが折りたたまれている場合は新規レビューリンクが表示されないこと", async () => {
        const user = userEvent.setup();
        render(<Sidebar {...defaultProps} />);

        // 初期状態ではspace-1が展開されている
        expect(screen.getByText("新規レビュー")).toBeInTheDocument();

        // space-1を折りたたむ（Chevronをクリック）
        const chevron = document.querySelector('[data-chevron="true"]');
        if (chevron) {
          await user.click(chevron);
        }

        // 新規レビューリンクが非表示になる
        expect(screen.queryByText("新規レビュー")).not.toBeInTheDocument();
      });

      it("レビュースペースがない場合はレビュースペースがありませんと表示されること", () => {
        render(<Sidebar {...defaultProps} reviewSpaces={[]} />);

        expect(
          screen.getByText("レビュースペースがありません"),
        ).toBeInTheDocument();
        expect(screen.queryByText("新規レビュー")).not.toBeInTheDocument();
      });
    });
  });

  describe("基本機能", () => {
    it("プロジェクト名が表示されること", () => {
      render(<Sidebar {...defaultProps} />);

      expect(screen.getByText("テストプロジェクト")).toBeInTheDocument();
    });

    it("レビュースペース名が表示されること", () => {
      render(<Sidebar {...defaultProps} />);

      expect(screen.getByText("レビュースペース1")).toBeInTheDocument();
      expect(screen.getByText("レビュースペース2")).toBeInTheDocument();
    });

    it("展開されたスペースにチェックリストリンクが表示されること", () => {
      render(<Sidebar {...defaultProps} />);

      expect(screen.getByText("チェックリスト")).toBeInTheDocument();
    });

    it("展開されたスペースにレビュー対象が表示されること", () => {
      render(<Sidebar {...defaultProps} />);

      expect(screen.getByText("レビュー対象1")).toBeInTheDocument();
    });

    it("AIKATAロゴが表示されること", () => {
      render(<Sidebar {...defaultProps} />);

      expect(screen.getByText("AIKATA")).toBeInTheDocument();
    });
  });
});
