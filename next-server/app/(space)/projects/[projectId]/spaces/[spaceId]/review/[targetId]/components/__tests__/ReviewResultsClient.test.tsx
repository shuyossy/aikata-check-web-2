import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ReviewResultsClient } from "../ReviewResultsClient";

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
vi.mock("../../hooks/useReviewResultsPolling", () => ({
  useReviewResultsPolling: vi.fn(({ currentStatus }) => ({
    isPolling: currentStatus === "reviewing",
  })),
}));

describe("ReviewResultsClient", () => {
  // テスト用の基本props
  const baseProps = {
    projectId: "project-1",
    projectName: "テストプロジェクト",
    spaceId: "space-1",
    spaceName: "テストスペース",
    targetId: "target-1",
  };

  // テスト用のレビュー対象データ型
  interface ReviewResultForTest {
    id: string;
    checkListItemContent: string;
    evaluation: string | null;
    comment: string | null;
    errorMessage: string | null;
    createdAt: Date;
  }

  interface ReviewSettingsForTest {
    additionalInstructions: string | null;
    concurrentReviewItems?: number;
    commentFormat: string | null;
    evaluationCriteria?: Array<{ label: string; description: string }>;
  }

  interface ReviewTargetForTest {
    id: string;
    reviewSpaceId: string;
    name: string;
    status: string;
    reviewSettings: ReviewSettingsForTest | null;
    reviewResults: ReviewResultForTest[];
    createdAt: Date;
    updatedAt: Date;
  }

  const createReviewTarget = (
    overrides: Partial<ReviewTargetForTest> = {}
  ): ReviewTargetForTest => {
    const now = new Date();
    return {
      id: "target-1",
      reviewSpaceId: "space-1",
      name: "テストレビュー対象",
      status: "completed",
      reviewSettings: null,
      reviewResults: [],
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("レンダリング", () => {
    describe("ステータスバナー表示", () => {
      it('status === "pending"の場合、準備中バナーが表示される', () => {
        const reviewTarget = createReviewTarget({ status: "pending" });
        render(<ReviewResultsClient {...baseProps} reviewTarget={reviewTarget} />);

        expect(screen.getByText("準備中")).toBeInTheDocument();
        expect(screen.getByText("レビュー実行を待機しています。")).toBeInTheDocument();
      });

      it('status === "reviewing"の場合、レビュー実行中バナーが表示される', () => {
        const reviewTarget = createReviewTarget({ status: "reviewing" });
        render(<ReviewResultsClient {...baseProps} reviewTarget={reviewTarget} />);

        expect(screen.getByText("レビュー実行中")).toBeInTheDocument();
        expect(
          screen.getByText("AIがドキュメントをレビューしています。しばらくお待ちください。")
        ).toBeInTheDocument();
      });

      it('status === "completed"の場合、レビュー完了バナーが表示される', () => {
        const reviewTarget = createReviewTarget({ status: "completed" });
        render(<ReviewResultsClient {...baseProps} reviewTarget={reviewTarget} />);

        expect(screen.getByText("レビュー完了")).toBeInTheDocument();
        expect(screen.getByText(/レビュー完了日時:/)).toBeInTheDocument();
      });

      it('status === "error"の場合、エラー発生バナーが表示される', () => {
        const reviewTarget = createReviewTarget({ status: "error" });
        render(<ReviewResultsClient {...baseProps} reviewTarget={reviewTarget} />);

        expect(screen.getByText("エラー発生")).toBeInTheDocument();
        expect(
          screen.getByText("レビュー実行中にエラーが発生しました。")
        ).toBeInTheDocument();
      });
    });

    describe("レビュー結果テーブル表示", () => {
      it("レビュー結果が表示される", () => {
        const reviewTarget = createReviewTarget({
          status: "completed",
          reviewResults: [
            {
              id: "result-1",
              checkListItemContent: "セキュリティ要件を確認する",
              evaluation: "A",
              comment: "問題ありません",
              errorMessage: null,
              createdAt: new Date(),
            },
            {
              id: "result-2",
              checkListItemContent: "パフォーマンス要件を確認する",
              evaluation: "B",
              comment: "一部改善が必要です",
              errorMessage: null,
              createdAt: new Date(),
            },
          ],
        });

        render(<ReviewResultsClient {...baseProps} reviewTarget={reviewTarget} />);

        expect(screen.getByText("セキュリティ要件を確認する")).toBeInTheDocument();
        expect(screen.getByText("パフォーマンス要件を確認する")).toBeInTheDocument();
        expect(screen.getByText("問題ありません")).toBeInTheDocument();
        expect(screen.getByText("一部改善が必要です")).toBeInTheDocument();
      });

      it("空のレビュー結果の場合、適切なメッセージが表示される", () => {
        const reviewTarget = createReviewTarget({
          status: "completed",
          reviewResults: [],
        });

        render(<ReviewResultsClient {...baseProps} reviewTarget={reviewTarget} />);

        expect(screen.getByText("レビュー結果がありません")).toBeInTheDocument();
      });

      it('レビュー実行中で結果がない場合、"レビュー実行中..."が表示される', () => {
        const reviewTarget = createReviewTarget({
          status: "reviewing",
          reviewResults: [],
        });

        render(<ReviewResultsClient {...baseProps} reviewTarget={reviewTarget} />);

        expect(screen.getByText("レビュー実行中...")).toBeInTheDocument();
      });

      it("評定A/B/Cが適切なスタイルで表示される", () => {
        const reviewTarget = createReviewTarget({
          status: "completed",
          reviewResults: [
            {
              id: "result-1",
              checkListItemContent: "項目1",
              evaluation: "A",
              comment: null,
              errorMessage: null,
              createdAt: new Date(),
            },
            {
              id: "result-2",
              checkListItemContent: "項目2",
              evaluation: "B",
              comment: null,
              errorMessage: null,
              createdAt: new Date(),
            },
            {
              id: "result-3",
              checkListItemContent: "項目3",
              evaluation: "C",
              comment: null,
              errorMessage: null,
              createdAt: new Date(),
            },
          ],
        });

        render(<ReviewResultsClient {...baseProps} reviewTarget={reviewTarget} />);

        // 評定バッジが表示されていることを確認
        const aBadge = screen.getByText("A");
        const bBadge = screen.getByText("B");
        const cBadge = screen.getByText("C");

        expect(aBadge).toHaveClass("bg-green-100");
        expect(bBadge).toHaveClass("bg-yellow-100");
        expect(cBadge).toHaveClass("bg-red-100");
      });
    });

    describe("エラー表示", () => {
      it("レビュー結果にエラーがある場合、エラーメッセージが表示される", () => {
        const reviewTarget = createReviewTarget({
          status: "completed",
          reviewResults: [
            {
              id: "result-1",
              checkListItemContent: "エラーが発生した項目",
              evaluation: null,
              comment: null,
              errorMessage: "AI処理中にエラーが発生しました",
              createdAt: new Date(),
            },
          ],
        });

        render(<ReviewResultsClient {...baseProps} reviewTarget={reviewTarget} />);

        expect(screen.getByText("エラーが発生した項目")).toBeInTheDocument();
        expect(screen.getByText("AI処理中にエラーが発生しました")).toBeInTheDocument();
        // エラーバッジが存在することを確認（bg-red-100クラスを持つ要素）
        const errorBadges = screen.getAllByText("エラー");
        const errorBadge = errorBadges.find((el) => el.classList.contains("bg-red-100"));
        expect(errorBadge).toBeInTheDocument();
      });

      it("エラーの場合、評定欄にエラーバッジが表示される", () => {
        const reviewTarget = createReviewTarget({
          status: "completed",
          reviewResults: [
            {
              id: "result-1",
              checkListItemContent: "エラー項目",
              evaluation: null,
              comment: null,
              errorMessage: "テストエラーメッセージ",
              createdAt: new Date(),
            },
          ],
        });

        render(<ReviewResultsClient {...baseProps} reviewTarget={reviewTarget} />);

        // エラーバッジが表示されていることを確認（bg-red-100クラスを持つ要素）
        const errorBadges = screen.getAllByText("エラー");
        const errorBadge = errorBadges.find((el) => el.classList.contains("bg-red-100"));
        expect(errorBadge).toBeInTheDocument();
        expect(errorBadge).toHaveClass("text-red-800");
      });
    });
  });

  describe("ボタン状態", () => {
    it('status === "reviewing"の場合、Q&A/リトライ/CSV出力ボタンが無効になる', () => {
      const reviewTarget = createReviewTarget({ status: "reviewing" });
      render(<ReviewResultsClient {...baseProps} reviewTarget={reviewTarget} />);

      const qaButton = screen.getByRole("button", { name: /Q&A/i });
      const retryButton = screen.getByRole("button", { name: /リトライ/i });
      const csvButton = screen.getByRole("button", { name: /CSV出力/i });

      expect(qaButton).toBeDisabled();
      expect(retryButton).toBeDisabled();
      expect(csvButton).toBeDisabled();
    });

    it('status === "completed"の場合、Q&A/リトライ/CSV出力ボタンが有効になる', () => {
      const reviewTarget = createReviewTarget({ status: "completed" });
      render(<ReviewResultsClient {...baseProps} reviewTarget={reviewTarget} />);

      const qaButton = screen.getByRole("button", { name: /Q&A/i });
      const retryButton = screen.getByRole("button", { name: /リトライ/i });
      const csvButton = screen.getByRole("button", { name: /CSV出力/i });

      expect(qaButton).not.toBeDisabled();
      expect(retryButton).not.toBeDisabled();
      expect(csvButton).not.toBeDisabled();
    });

    it('status === "error"の場合、Q&A/リトライ/CSV出力ボタンが有効になる', () => {
      const reviewTarget = createReviewTarget({ status: "error" });
      render(<ReviewResultsClient {...baseProps} reviewTarget={reviewTarget} />);

      const qaButton = screen.getByRole("button", { name: /Q&A/i });
      const retryButton = screen.getByRole("button", { name: /リトライ/i });
      const csvButton = screen.getByRole("button", { name: /CSV出力/i });

      expect(qaButton).not.toBeDisabled();
      expect(retryButton).not.toBeDisabled();
      expect(csvButton).not.toBeDisabled();
    });

    it('status === "pending"の場合、Q&A/リトライ/CSV出力ボタンが有効になる', () => {
      const reviewTarget = createReviewTarget({ status: "pending" });
      render(<ReviewResultsClient {...baseProps} reviewTarget={reviewTarget} />);

      const qaButton = screen.getByRole("button", { name: /Q&A/i });
      const retryButton = screen.getByRole("button", { name: /リトライ/i });
      const csvButton = screen.getByRole("button", { name: /CSV出力/i });

      expect(qaButton).not.toBeDisabled();
      expect(retryButton).not.toBeDisabled();
      expect(csvButton).not.toBeDisabled();
    });
  });

  describe("ポーリング表示", () => {
    it('status === "reviewing"の場合、"(自動更新中)"が表示される', () => {
      const reviewTarget = createReviewTarget({ status: "reviewing" });
      render(<ReviewResultsClient {...baseProps} reviewTarget={reviewTarget} />);

      expect(screen.getByText("(自動更新中)")).toBeInTheDocument();
    });

    it('status === "completed"の場合、"(自動更新中)"が表示されない', () => {
      const reviewTarget = createReviewTarget({ status: "completed" });
      render(<ReviewResultsClient {...baseProps} reviewTarget={reviewTarget} />);

      expect(screen.queryByText("(自動更新中)")).not.toBeInTheDocument();
    });

    it('status === "error"の場合、"(自動更新中)"が表示されない', () => {
      const reviewTarget = createReviewTarget({ status: "error" });
      render(<ReviewResultsClient {...baseProps} reviewTarget={reviewTarget} />);

      expect(screen.queryByText("(自動更新中)")).not.toBeInTheDocument();
    });

    it('status === "pending"の場合、"(自動更新中)"が表示されない', () => {
      const reviewTarget = createReviewTarget({ status: "pending" });
      render(<ReviewResultsClient {...baseProps} reviewTarget={reviewTarget} />);

      expect(screen.queryByText("(自動更新中)")).not.toBeInTheDocument();
    });
  });

  describe("パンくずリスト", () => {
    it("正しいパンくずリストが表示される", () => {
      const reviewTarget = createReviewTarget({ name: "レビュー対象A" });
      render(<ReviewResultsClient {...baseProps} reviewTarget={reviewTarget} />);

      expect(screen.getByText("テストプロジェクト")).toBeInTheDocument();
      expect(screen.getByText("テストスペース")).toBeInTheDocument();
      // レビュー対象名はパンくずリストとページタイトルの両方に表示される
      const reviewTargetNames = screen.getAllByText("レビュー対象A");
      expect(reviewTargetNames.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("ヘルプセクション", () => {
    it("レビュー結果の活用方法が表示される", () => {
      const reviewTarget = createReviewTarget({});
      render(<ReviewResultsClient {...baseProps} reviewTarget={reviewTarget} />);

      expect(screen.getByText("レビュー結果の活用方法")).toBeInTheDocument();
      expect(
        screen.getByText(/「リトライ」で改善後に再度レビューを実行できます/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/「CSV出力」で結果をExcelなどで加工・共有できます/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/「Q&A」でレビュー結果について質問できます/)
      ).toBeInTheDocument();
    });
  });

  describe("レビュー結果の表示順", () => {
    it("レビュー結果が作成日時順にソートされる", () => {
      const baseDate = new Date("2024-01-01T00:00:00Z");
      const reviewTarget = createReviewTarget({
        status: "completed",
        reviewResults: [
          {
            id: "result-3",
            checkListItemContent: "項目3（最新）",
            evaluation: "A",
            comment: null,
            errorMessage: null,
            createdAt: new Date(baseDate.getTime() + 2000),
          },
          {
            id: "result-1",
            checkListItemContent: "項目1（最古）",
            evaluation: "A",
            comment: null,
            errorMessage: null,
            createdAt: new Date(baseDate.getTime()),
          },
          {
            id: "result-2",
            checkListItemContent: "項目2（中間）",
            evaluation: "A",
            comment: null,
            errorMessage: null,
            createdAt: new Date(baseDate.getTime() + 1000),
          },
        ],
      });

      render(<ReviewResultsClient {...baseProps} reviewTarget={reviewTarget} />);

      const rows = screen.getAllByRole("row");
      // ヘッダー行を除く
      const dataRows = rows.slice(1);

      // 作成日時の昇順でソートされていることを確認
      expect(within(dataRows[0]).getByText("項目1（最古）")).toBeInTheDocument();
      expect(within(dataRows[1]).getByText("項目2（中間）")).toBeInTheDocument();
      expect(within(dataRows[2]).getByText("項目3（最新）")).toBeInTheDocument();
    });
  });

  describe("評定が存在しない場合", () => {
    it("評定がnullの場合、ハイフンが表示される", () => {
      const reviewTarget = createReviewTarget({
        status: "completed",
        reviewResults: [
          {
            id: "result-1",
            checkListItemContent: "評定なし項目",
            evaluation: null,
            comment: "コメントのみ",
            errorMessage: null,
            createdAt: new Date(),
          },
        ],
      });

      render(<ReviewResultsClient {...baseProps} reviewTarget={reviewTarget} />);

      // 評定欄にハイフンが表示される（評定もコメントもnullではなく、エラーでもない場合）
      const cells = screen.getAllByRole("cell");
      // 評定セルを探す（3番目のセル）
      const evaluationCell = cells.find(
        (cell) =>
          cell.textContent === "-" &&
          !cell.textContent?.includes("評定なし項目") &&
          !cell.textContent?.includes("コメントのみ")
      );
      expect(evaluationCell).toBeInTheDocument();
    });
  });

  describe("コメントが存在しない場合", () => {
    it("コメントがnullの場合、ハイフンが表示される", () => {
      const reviewTarget = createReviewTarget({
        status: "completed",
        reviewResults: [
          {
            id: "result-1",
            checkListItemContent: "コメントなし項目",
            evaluation: "A",
            comment: null,
            errorMessage: null,
            createdAt: new Date(),
          },
        ],
      });

      render(<ReviewResultsClient {...baseProps} reviewTarget={reviewTarget} />);

      expect(screen.getByText("コメントなし項目")).toBeInTheDocument();
      // コメント欄にハイフンが表示される
      const cells = screen.getAllByRole("cell");
      const commentCell = cells[3]; // 4番目のセル（No., チェック項目, 評定, コメント）
      expect(commentCell.textContent).toBe("-");
    });
  });
});
