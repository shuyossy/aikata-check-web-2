import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExecuteQaService } from "../ExecuteQaService";
import type { IQaHistoryRepository } from "@/application/shared/port/repository/IQaHistoryRepository";
import type { IReviewTargetRepository } from "@/application/shared/port/repository/IReviewTargetRepository";
import type { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import type { IProjectRepository } from "@/application/shared/port/repository";
import { ReviewTargetId } from "@/domain/reviewTarget";
import { ReviewSpaceId } from "@/domain/reviewSpace";
import { ProjectId } from "@/domain/project";

describe("ExecuteQaService", () => {
  // モックリポジトリ
  let mockQaHistoryRepository: IQaHistoryRepository;
  let mockReviewTargetRepository: IReviewTargetRepository;
  let mockReviewSpaceRepository: IReviewSpaceRepository;
  let mockProjectRepository: IProjectRepository;
  let service: ExecuteQaService;

  // テストデータ
  const testUserId = "550e8400-e29b-41d4-a716-446655440001";
  const testReviewTargetId = "550e8400-e29b-41d4-a716-446655440002";
  const testReviewSpaceId = "550e8400-e29b-41d4-a716-446655440003";
  const testProjectId = "550e8400-e29b-41d4-a716-446655440004";

  // モックエンティティ作成ヘルパー
  const createMockReviewTarget = () => ({
    id: ReviewTargetId.reconstruct(testReviewTargetId),
    reviewSpaceId: ReviewSpaceId.reconstruct(testReviewSpaceId),
  });

  const createMockReviewSpace = () => ({
    id: ReviewSpaceId.reconstruct(testReviewSpaceId),
    projectId: ProjectId.reconstruct(testProjectId),
  });

  const createMockProject = (memberIds: string[]) => ({
    id: ProjectId.reconstruct(testProjectId),
    hasMember: vi.fn((userId: string) => memberIds.includes(userId)),
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockQaHistoryRepository = {
      findById: vi.fn(),
      findByReviewTargetId: vi.fn(),
      save: vi.fn(),
      updateAnswer: vi.fn(),
      updateError: vi.fn(),
      updateStatus: vi.fn(),
      delete: vi.fn(),
      deleteByReviewTargetId: vi.fn(),
    };

    mockReviewTargetRepository = {
      findById: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      findByReviewSpaceId: vi.fn(),
    } as unknown as IReviewTargetRepository;

    mockReviewSpaceRepository = {
      findById: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      findByProjectId: vi.fn(),
    } as unknown as IReviewSpaceRepository;

    mockProjectRepository = {
      findById: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    } as unknown as IProjectRepository;

    service = new ExecuteQaService(
      mockQaHistoryRepository,
      mockReviewTargetRepository,
      mockReviewSpaceRepository,
      mockProjectRepository,
    );
  });

  describe("正常系", () => {
    it("Q&A履歴を作成してIDを返す", async () => {
      // Arrange
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(createMockReviewTarget() as any);
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(createMockReviewSpace() as any);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(createMockProject([testUserId]) as any);

      // Act
      const result = await service.execute({
        reviewTargetId: testReviewTargetId,
        question: "テスト質問",
        checklistItemContents: ["チェック項目内容"],
        userId: testUserId,
      });

      // Assert
      expect(result.qaHistoryId).toBeDefined();
      // UUIDフォーマットの検証
      expect(result.qaHistoryId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
      expect(mockQaHistoryRepository.save).toHaveBeenCalledTimes(1);
    });

    it("Q&A履歴がpending状態で保存される（ワークフローはSSE接続後に開始される）", async () => {
      // Arrange
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(createMockReviewTarget() as any);
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(createMockReviewSpace() as any);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(createMockProject([testUserId]) as any);

      // Act
      await service.execute({
        reviewTargetId: testReviewTargetId,
        question: "テスト質問",
        checklistItemContents: ["チェック項目内容"],
        userId: testUserId,
      });

      // Assert
      const savedQaHistory = vi.mocked(mockQaHistoryRepository.save).mock.calls[0][0];
      expect(savedQaHistory.isPending()).toBe(true);
      expect(savedQaHistory.question.value).toBe("テスト質問");
      // レビュー対象ID、ユーザーIDが正しく設定されていることを確認
      expect(savedQaHistory.reviewTargetId.value).toBe(testReviewTargetId);
      expect(savedQaHistory.userId.value).toBe(testUserId);
      // 回答とエラーメッセージが初期状態であることを確認
      expect(savedQaHistory.answer).toBeNull();
      expect(savedQaHistory.errorMessage).toBeNull();
    });

    it("複数のチェック項目をJSON配列として保存する", async () => {
      // Arrange
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(createMockReviewTarget() as any);
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(createMockReviewSpace() as any);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(createMockProject([testUserId]) as any);

      const checklistItemContents = ["チェック項目1", "チェック項目2", "チェック項目3"];

      // Act
      await service.execute({
        reviewTargetId: testReviewTargetId,
        question: "テスト質問",
        checklistItemContents,
        userId: testUserId,
      });

      // Assert
      const savedQaHistory = vi.mocked(mockQaHistoryRepository.save).mock.calls[0][0];
      const savedChecklistItems = JSON.parse(savedQaHistory.checkListItemContent.value);
      expect(savedChecklistItems).toEqual(checklistItemContents);
      expect(savedChecklistItems).toHaveLength(3);
    });

    it("単一のチェック項目も配列として保存する", async () => {
      // Arrange
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(createMockReviewTarget() as any);
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(createMockReviewSpace() as any);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(createMockProject([testUserId]) as any);

      const checklistItemContents = ["単一チェック項目"];

      // Act
      await service.execute({
        reviewTargetId: testReviewTargetId,
        question: "テスト質問",
        checklistItemContents,
        userId: testUserId,
      });

      // Assert
      const savedQaHistory = vi.mocked(mockQaHistoryRepository.save).mock.calls[0][0];
      const savedChecklistItems = JSON.parse(savedQaHistory.checkListItemContent.value);
      expect(savedChecklistItems).toEqual(["単一チェック項目"]);
      expect(Array.isArray(savedChecklistItems)).toBe(true);
    });
  });

  describe("異常系", () => {
    it("チェック項目内容が空配列の場合はエラーを投げる", async () => {
      // 権限チェック前にチェックリスト項目の検証が行われることを確認
      // Act & Assert
      await expect(
        service.execute({
          reviewTargetId: testReviewTargetId,
          question: "テスト質問",
          checklistItemContents: [],
          userId: testUserId,
        }),
      ).rejects.toMatchObject({ messageCode: "QA_HISTORY_CHECKLIST_ITEM_CONTENT_EMPTY" });

      // リポジトリは呼ばれないことを確認（早期リターン）
      expect(mockReviewTargetRepository.findById).not.toHaveBeenCalled();
    });

    it("レビュー対象が見つからない場合はエラーを投げる", async () => {
      // Arrange
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.execute({
          reviewTargetId: testReviewTargetId,
          question: "テスト質問",
          checklistItemContents: ["チェック項目内容"],
          userId: testUserId,
        }),
      ).rejects.toMatchObject({ messageCode: "REVIEW_TARGET_NOT_FOUND" });
    });

    it("レビュースペースが見つからない場合はエラーを投げる", async () => {
      // Arrange
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(createMockReviewTarget() as any);
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.execute({
          reviewTargetId: testReviewTargetId,
          question: "テスト質問",
          checklistItemContents: ["チェック項目内容"],
          userId: testUserId,
        }),
      ).rejects.toMatchObject({ messageCode: "REVIEW_SPACE_NOT_FOUND" });
    });

    it("プロジェクトが見つからない場合はエラーを投げる", async () => {
      // Arrange
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(createMockReviewTarget() as any);
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(createMockReviewSpace() as any);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.execute({
          reviewTargetId: testReviewTargetId,
          question: "テスト質問",
          checklistItemContents: ["チェック項目内容"],
          userId: testUserId,
        }),
      ).rejects.toMatchObject({ messageCode: "PROJECT_NOT_FOUND" });
    });

    it("プロジェクトメンバーでない場合はエラーを投げる", async () => {
      // Arrange
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(createMockReviewTarget() as any);
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(createMockReviewSpace() as any);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(createMockProject([]) as any); // メンバーなし

      // Act & Assert
      await expect(
        service.execute({
          reviewTargetId: testReviewTargetId,
          question: "テスト質問",
          checklistItemContents: ["チェック項目内容"],
          userId: testUserId,
        }),
      ).rejects.toMatchObject({ messageCode: "REVIEW_TARGET_ACCESS_DENIED" });
    });

    it("質問が空の場合はエラーを投げる（Questionドメインバリデーション）", async () => {
      // Arrange - 権限チェックは通過する設定
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(createMockReviewTarget() as any);
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(createMockReviewSpace() as any);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(createMockProject([testUserId]) as any);

      // Act & Assert
      await expect(
        service.execute({
          reviewTargetId: testReviewTargetId,
          question: "",
          checklistItemContents: ["チェック項目内容"],
          userId: testUserId,
        }),
      ).rejects.toThrow();

      // Q&A履歴が保存されないことを確認
      expect(mockQaHistoryRepository.save).not.toHaveBeenCalled();
    });

    it("質問が空白のみの場合はエラーを投げる", async () => {
      // Arrange
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(createMockReviewTarget() as any);
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(createMockReviewSpace() as any);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(createMockProject([testUserId]) as any);

      // Act & Assert
      await expect(
        service.execute({
          reviewTargetId: testReviewTargetId,
          question: "   ",
          checklistItemContents: ["チェック項目内容"],
          userId: testUserId,
        }),
      ).rejects.toThrow();
    });
  });
});
