import { describe, it, expect, vi, beforeEach } from "vitest";
import { ListQaHistoriesService } from "../ListQaHistoriesService";
import type { IQaHistoryRepository } from "@/application/shared/port/repository/IQaHistoryRepository";
import type { IReviewTargetRepository } from "@/application/shared/port/repository/IReviewTargetRepository";
import type { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import type { IProjectRepository } from "@/application/shared/port/repository";
import { QaHistory, QaHistoryId, Question, CheckListItemContent, Answer, ResearchSummary, QaStatus } from "@/domain/qaHistory";
import { ReviewTargetId } from "@/domain/reviewTarget";
import { ReviewSpaceId } from "@/domain/reviewSpace";
import { ProjectId } from "@/domain/project";
import { UserId } from "@/domain/user";

describe("ListQaHistoriesService", () => {
  // モックリポジトリ
  let mockQaHistoryRepository: IQaHistoryRepository;
  let mockReviewTargetRepository: IReviewTargetRepository;
  let mockReviewSpaceRepository: IReviewSpaceRepository;
  let mockProjectRepository: IProjectRepository;
  let service: ListQaHistoriesService;

  // テストデータ
  const testUserId = "550e8400-e29b-41d4-a716-446655440001";
  const testReviewTargetId = "550e8400-e29b-41d4-a716-446655440002";
  const testReviewSpaceId = "550e8400-e29b-41d4-a716-446655440003";
  const testProjectId = "550e8400-e29b-41d4-a716-446655440004";
  const testQaHistoryId = "550e8400-e29b-41d4-a716-446655440005";

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

  const createMockQaHistory = (options?: { answer?: string; researchSummary?: any; status?: string }) => {
    return QaHistory.reconstruct({
      id: QaHistoryId.reconstruct(testQaHistoryId),
      reviewTargetId: ReviewTargetId.reconstruct(testReviewTargetId),
      userId: UserId.reconstruct(testUserId),
      question: Question.create("テスト質問"),
      checkListItemContent: CheckListItemContent.create("チェック項目内容"),
      answer: options?.answer ? Answer.create(options.answer) : null,
      researchSummary: options?.researchSummary ? ResearchSummary.create(options.researchSummary) : null,
      status: options?.status === "completed" ? QaStatus.completed() : QaStatus.processing(),
      errorMessage: null,
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-01-01T00:00:00Z"),
    });
  };

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

    service = new ListQaHistoriesService(
      mockQaHistoryRepository,
      mockReviewTargetRepository,
      mockReviewSpaceRepository,
      mockProjectRepository,
    );
  });

  describe("正常系", () => {
    it("Q&A履歴一覧を正常に取得できる", async () => {
      // Arrange
      const mockQaHistory = createMockQaHistory({
        answer: "テスト回答",
        researchSummary: [
          { documentName: "test.docx", researchContent: "調査内容", researchResult: "調査結果" },
        ],
        status: "completed",
      });

      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(createMockReviewTarget() as any);
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(createMockReviewSpace() as any);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(createMockProject([testUserId]) as any);
      vi.mocked(mockQaHistoryRepository.findByReviewTargetId).mockResolvedValue({
        items: [mockQaHistory],
        total: 1,
      });

      // Act
      const result = await service.execute({
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
      });

      // Assert
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);

      // DTO変換結果の詳細検証
      const item = result.items[0];
      expect(item.id).toBe(testQaHistoryId);
      expect(item.question).toBe("テスト質問");
      expect(item.checklistItemContent).toBe("チェック項目内容");
      expect(item.answer).toBe("テスト回答");
      expect(item.status).toBe("completed");
      expect(item.errorMessage).toBeNull();

      // 日時フィールドの検証
      expect(item.createdAt).toEqual(new Date("2024-01-01T00:00:00Z"));
      expect(item.updatedAt).toEqual(new Date("2024-01-01T00:00:00Z"));

      // researchSummaryがJSON文字列に変換されていることを確認
      expect(typeof item.researchSummary).toBe("string");
      const parsedSummary = JSON.parse(item.researchSummary!);
      expect(parsedSummary).toHaveLength(1);
      expect(parsedSummary[0].documentName).toBe("test.docx");
      expect(parsedSummary[0].researchContent).toBe("調査内容");
      expect(parsedSummary[0].researchResult).toBe("調査結果");
    });

    it("ページネーションパラメータが正しく渡される", async () => {
      // Arrange
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(createMockReviewTarget() as any);
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(createMockReviewSpace() as any);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(createMockProject([testUserId]) as any);
      vi.mocked(mockQaHistoryRepository.findByReviewTargetId).mockResolvedValue({
        items: [],
        total: 0,
      });

      // Act
      await service.execute({
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
        limit: 10,
        offset: 5,
      });

      // Assert
      expect(mockQaHistoryRepository.findByReviewTargetId).toHaveBeenCalledWith(
        expect.any(Object),
        { limit: 10, offset: 5 },
      );
    });

    it("デフォルトのページネーションパラメータが使用される", async () => {
      // Arrange
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(createMockReviewTarget() as any);
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(createMockReviewSpace() as any);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(createMockProject([testUserId]) as any);
      vi.mocked(mockQaHistoryRepository.findByReviewTargetId).mockResolvedValue({
        items: [],
        total: 0,
      });

      // Act
      await service.execute({
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
      });

      // Assert
      expect(mockQaHistoryRepository.findByReviewTargetId).toHaveBeenCalledWith(
        expect.any(Object),
        { limit: 20, offset: 0 },
      );
    });

    it("処理中のQ&A履歴が正しく変換される", async () => {
      // Arrange
      const mockQaHistory = createMockQaHistory();

      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(createMockReviewTarget() as any);
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(createMockReviewSpace() as any);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(createMockProject([testUserId]) as any);
      vi.mocked(mockQaHistoryRepository.findByReviewTargetId).mockResolvedValue({
        items: [mockQaHistory],
        total: 1,
      });

      // Act
      const result = await service.execute({
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
      });

      // Assert
      expect(result.items[0].answer).toBeNull();
      expect(result.items[0].researchSummary).toBeNull();
      expect(result.items[0].status).toBe("processing");
    });

    it("空の履歴一覧を取得する場合も正常に返される", async () => {
      // Arrange
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(createMockReviewTarget() as any);
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(createMockReviewSpace() as any);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(createMockProject([testUserId]) as any);
      vi.mocked(mockQaHistoryRepository.findByReviewTargetId).mockResolvedValue({
        items: [],
        total: 0,
      });

      // Act
      const result = await service.execute({
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
      });

      // Assert
      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(Array.isArray(result.items)).toBe(true);
    });

    it("JSON配列形式の複数チェック項目を正しくDTOに変換する", async () => {
      // Arrange - 複数チェック項目をJSON配列として保存
      const multipleItems = ["チェック項目1", "チェック項目2", "チェック項目3"];
      const mockQaHistory = QaHistory.reconstruct({
        id: QaHistoryId.reconstruct(testQaHistoryId),
        reviewTargetId: ReviewTargetId.reconstruct(testReviewTargetId),
        userId: UserId.reconstruct(testUserId),
        question: Question.create("複数項目に関する質問"),
        checkListItemContent: CheckListItemContent.create(JSON.stringify(multipleItems)),
        answer: Answer.create("複数項目への回答"),
        researchSummary: null,
        status: QaStatus.completed(),
        errorMessage: null,
        createdAt: new Date("2024-01-01T00:00:00Z"),
        updatedAt: new Date("2024-01-01T00:00:00Z"),
      });

      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(createMockReviewTarget() as any);
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(createMockReviewSpace() as any);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(createMockProject([testUserId]) as any);
      vi.mocked(mockQaHistoryRepository.findByReviewTargetId).mockResolvedValue({
        items: [mockQaHistory],
        total: 1,
      });

      // Act
      const result = await service.execute({
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
      });

      // Assert
      expect(result.items).toHaveLength(1);
      const item = result.items[0];
      // checklistItemContentはJSON文字列のままDTOに変換される
      expect(item.checklistItemContent).toBe(JSON.stringify(multipleItems));
      // パースして検証
      const parsedItems = JSON.parse(item.checklistItemContent);
      expect(parsedItems).toHaveLength(3);
      expect(parsedItems).toEqual(multipleItems);
    });
  });

  describe("異常系", () => {
    it("レビュー対象が見つからない場合はエラーを投げる", async () => {
      // Arrange
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.execute({
          reviewTargetId: testReviewTargetId,
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
          userId: testUserId,
        }),
      ).rejects.toMatchObject({ messageCode: "REVIEW_TARGET_ACCESS_DENIED" });
    });
  });
});
