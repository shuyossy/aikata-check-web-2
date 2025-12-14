import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  SaveApiReviewResultsService,
  type SaveApiReviewResultsCommand,
} from "../SaveApiReviewResultsService";
import type { IReviewTargetRepository } from "@/application/shared/port/repository/IReviewTargetRepository";
import type { IReviewResultRepository } from "@/application/shared/port/repository/IReviewResultRepository";
import type { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import type { IProjectRepository } from "@/application/shared/port/repository";
import { ReviewSpace } from "@/domain/reviewSpace";
import { Project } from "@/domain/project";
import { ReviewTarget } from "@/domain/reviewTarget";
import { ReviewResult } from "@/domain/reviewResult";

describe("SaveApiReviewResultsService", () => {
  // モックリポジトリ
  const mockReviewTargetRepository: IReviewTargetRepository = {
    findById: vi.fn(),
    findByReviewSpaceId: vi.fn(),
    countByReviewSpaceId: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };

  const mockReviewResultRepository: IReviewResultRepository = {
    findById: vi.fn(),
    findByReviewTargetId: vi.fn(),
    countByReviewTargetId: vi.fn(),
    save: vi.fn(),
    saveMany: vi.fn(),
    delete: vi.fn(),
    deleteByReviewTargetId: vi.fn(),
  };

  const mockReviewSpaceRepository: IReviewSpaceRepository = {
    findById: vi.fn(),
    findByProjectId: vi.fn(),
    countByProjectId: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };

  const mockProjectRepository: IProjectRepository = {
    findById: vi.fn(),
    findByMemberId: vi.fn(),
    countByMemberId: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };

  let service: SaveApiReviewResultsService;

  // テスト用データ（有効なUUID v4形式）
  const testProjectId = "550e8400-e29b-41d4-a716-446655440001";
  const testReviewSpaceId = "550e8400-e29b-41d4-a716-446655440002";
  const testUserId = "550e8400-e29b-41d4-a716-446655440003";
  const testReviewTargetId = "550e8400-e29b-41d4-a716-446655440010";
  const testCheckListItemId1 = "550e8400-e29b-41d4-a716-446655440004";
  const testCheckListItemId2 = "550e8400-e29b-41d4-a716-446655440005";

  const testProject = Project.reconstruct({
    id: testProjectId,
    name: "テストプロジェクト",
    description: null,
    encryptedApiKey: null,
    members: [{ userId: testUserId, createdAt: new Date() }],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const testReviewSpace = ReviewSpace.reconstruct({
    id: testReviewSpaceId,
    projectId: testProjectId,
    name: "テストスペース",
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // API種別・レビュー中のReviewTarget
  const createApiReviewingTarget = () => {
    const target = ReviewTarget.create({
      reviewSpaceId: testReviewSpaceId,
      name: "テスト外部APIレビュー",
      reviewType: "api",
    });
    return target.startReviewing();
  };

  // 通常種別（small）・レビュー中のReviewTarget
  const createSmallReviewingTarget = () => {
    const target = ReviewTarget.create({
      reviewSpaceId: testReviewSpaceId,
      name: "テスト通常レビュー",
      reviewType: "small",
    });
    return target.startReviewing();
  };

  // API種別・完了状態のReviewTarget
  const createApiCompletedTarget = () => {
    const target = ReviewTarget.create({
      reviewSpaceId: testReviewSpaceId,
      name: "テスト外部APIレビュー",
      reviewType: "api",
    });
    return target.startReviewing().completeReview();
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SaveApiReviewResultsService(
      mockReviewTargetRepository,
      mockReviewResultRepository,
      mockReviewSpaceRepository,
      mockProjectRepository,
    );
  });

  describe("正常系", () => {
    it("外部APIレビュー結果をDBに保存できる", async () => {
      const reviewingTarget = createApiReviewingTarget();
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        reviewingTarget,
      );
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);

      const command: SaveApiReviewResultsCommand = {
        reviewTargetId: reviewingTarget.id.value,
        userId: testUserId,
        results: [
          {
            checkListItemId: testCheckListItemId1,
            checkListItemContent: "チェック項目1",
            evaluation: "A",
            comment: "問題ありません",
          },
          {
            checkListItemId: testCheckListItemId2,
            checkListItemContent: "チェック項目2",
            evaluation: "B",
            comment: "一部改善が必要",
          },
        ],
        chunkIndex: 0,
        totalChunks: 3,
      };

      const result = await service.execute(command);

      // 結果の検証
      expect(result.savedCount).toBe(2);
      expect(result.chunkIndex).toBe(0);
      expect(result.totalChunks).toBe(3);

      // saveManyが呼ばれることを確認
      expect(mockReviewResultRepository.saveMany).toHaveBeenCalledTimes(1);

      // 保存されたレビュー結果の検証
      const savedResults = vi.mocked(mockReviewResultRepository.saveMany).mock.calls[0][0] as ReviewResult[];
      expect(savedResults).toHaveLength(2);
      expect(savedResults[0].checkListItemContent).toBe("チェック項目1");
      expect(savedResults[0].evaluation?.value).toBe("A");
      expect(savedResults[1].checkListItemContent).toBe("チェック項目2");
      expect(savedResults[1].evaluation?.value).toBe("B");
    });

    it("単一の結果も保存できる", async () => {
      const reviewingTarget = createApiReviewingTarget();
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        reviewingTarget,
      );
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);

      const command: SaveApiReviewResultsCommand = {
        reviewTargetId: reviewingTarget.id.value,
        userId: testUserId,
        results: [
          {
            checkListItemId: testCheckListItemId1,
            checkListItemContent: "チェック項目1",
            evaluation: "A",
            comment: "問題ありません",
          },
        ],
        chunkIndex: 2,
        totalChunks: 3,
      };

      const result = await service.execute(command);

      expect(result.savedCount).toBe(1);
      expect(result.chunkIndex).toBe(2);
      expect(result.totalChunks).toBe(3);
    });
  });

  describe("異常系 - レビュー対象の検証", () => {
    it("レビュー対象が存在しない場合エラーになる", async () => {
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(null);

      const command: SaveApiReviewResultsCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
        results: [
          {
            checkListItemId: testCheckListItemId1,
            checkListItemContent: "チェック項目1",
            evaluation: "A",
            comment: "問題ありません",
          },
        ],
        chunkIndex: 0,
        totalChunks: 1,
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "REVIEW_TARGET_NOT_FOUND",
      });
    });

    it("レビュー種別がAPI以外の場合エラーになる", async () => {
      const smallTarget = createSmallReviewingTarget();
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        smallTarget,
      );

      const command: SaveApiReviewResultsCommand = {
        reviewTargetId: smallTarget.id.value,
        userId: testUserId,
        results: [
          {
            checkListItemId: testCheckListItemId1,
            checkListItemContent: "チェック項目1",
            evaluation: "A",
            comment: "問題ありません",
          },
        ],
        chunkIndex: 0,
        totalChunks: 1,
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "REVIEW_TYPE_INVALID",
      });
    });

    it("レビュー中でない場合エラーになる", async () => {
      const completedTarget = createApiCompletedTarget();
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        completedTarget,
      );

      const command: SaveApiReviewResultsCommand = {
        reviewTargetId: completedTarget.id.value,
        userId: testUserId,
        results: [
          {
            checkListItemId: testCheckListItemId1,
            checkListItemContent: "チェック項目1",
            evaluation: "A",
            comment: "問題ありません",
          },
        ],
        chunkIndex: 0,
        totalChunks: 1,
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "REVIEW_STATUS_NOT_REVIEWING",
      });
    });
  });

  describe("異常系 - 権限確認", () => {
    it("レビュースペースが存在しない場合エラーになる", async () => {
      const reviewingTarget = createApiReviewingTarget();
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        reviewingTarget,
      );
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(null);

      const command: SaveApiReviewResultsCommand = {
        reviewTargetId: reviewingTarget.id.value,
        userId: testUserId,
        results: [
          {
            checkListItemId: testCheckListItemId1,
            checkListItemContent: "チェック項目1",
            evaluation: "A",
            comment: "問題ありません",
          },
        ],
        chunkIndex: 0,
        totalChunks: 1,
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "REVIEW_SPACE_NOT_FOUND",
      });
    });

    it("プロジェクトが存在しない場合エラーになる", async () => {
      const reviewingTarget = createApiReviewingTarget();
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        reviewingTarget,
      );
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(null);

      const command: SaveApiReviewResultsCommand = {
        reviewTargetId: reviewingTarget.id.value,
        userId: testUserId,
        results: [
          {
            checkListItemId: testCheckListItemId1,
            checkListItemContent: "チェック項目1",
            evaluation: "A",
            comment: "問題ありません",
          },
        ],
        chunkIndex: 0,
        totalChunks: 1,
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "PROJECT_NOT_FOUND",
      });
    });

    it("プロジェクトメンバーでない場合エラーになる", async () => {
      const reviewingTarget = createApiReviewingTarget();
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        reviewingTarget,
      );
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);

      // メンバーではないユーザーID
      const nonMemberUserId = "550e8400-e29b-41d4-a716-446655440099";
      const command: SaveApiReviewResultsCommand = {
        reviewTargetId: reviewingTarget.id.value,
        userId: nonMemberUserId,
        results: [
          {
            checkListItemId: testCheckListItemId1,
            checkListItemContent: "チェック項目1",
            evaluation: "A",
            comment: "問題ありません",
          },
        ],
        chunkIndex: 0,
        totalChunks: 1,
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "PROJECT_ACCESS_DENIED",
      });
    });
  });

  describe("異常系 - 結果の検証", () => {
    it("結果が空の場合エラーになる", async () => {
      const reviewingTarget = createApiReviewingTarget();
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        reviewingTarget,
      );
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);

      const command: SaveApiReviewResultsCommand = {
        reviewTargetId: reviewingTarget.id.value,
        userId: testUserId,
        results: [],
        chunkIndex: 0,
        totalChunks: 1,
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "REVIEW_API_NO_RESULTS",
      });
    });
  });

  describe("エラー情報を含むレビュー結果", () => {
    it("errorが空文字列の場合、成功結果として保存される", async () => {
      const reviewingTarget = createApiReviewingTarget();
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        reviewingTarget,
      );
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);

      const command: SaveApiReviewResultsCommand = {
        reviewTargetId: reviewingTarget.id.value,
        userId: testUserId,
        results: [
          {
            checkListItemId: testCheckListItemId1,
            checkListItemContent: "チェック項目1",
            evaluation: "A",
            comment: "問題ありません",
            error: "", // 空文字列はfalsyなので成功として扱われる
          },
        ],
        chunkIndex: 0,
        totalChunks: 1,
      };

      const result = await service.execute(command);

      // 結果の検証
      expect(result.savedCount).toBe(1);

      // 保存されたレビュー結果が成功であることを確認
      const savedResults = vi.mocked(mockReviewResultRepository.saveMany).mock.calls[0][0] as ReviewResult[];
      expect(savedResults).toHaveLength(1);
      expect(savedResults[0].isSuccess()).toBe(true);
      expect(savedResults[0].evaluation?.value).toBe("A");
    });

    it("エラー情報を含む結果をエラーとして保存できる", async () => {
      const reviewingTarget = createApiReviewingTarget();
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        reviewingTarget,
      );
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);

      const command: SaveApiReviewResultsCommand = {
        reviewTargetId: reviewingTarget.id.value,
        userId: testUserId,
        results: [
          {
            checkListItemId: testCheckListItemId1,
            checkListItemContent: "チェック項目1",
            evaluation: "",
            comment: "",
            error: "チェック項目の処理中にエラーが発生しました",
          },
        ],
        chunkIndex: 0,
        totalChunks: 1,
      };

      const result = await service.execute(command);

      // 結果の検証
      expect(result.savedCount).toBe(1);

      // saveManyが呼ばれることを確認
      expect(mockReviewResultRepository.saveMany).toHaveBeenCalledTimes(1);

      // 保存されたレビュー結果がエラーであることを確認
      const savedResults = vi.mocked(mockReviewResultRepository.saveMany).mock.calls[0][0] as ReviewResult[];
      expect(savedResults).toHaveLength(1);
      expect(savedResults[0].isError()).toBe(true);
      expect(savedResults[0].errorMessage).toBe("チェック項目の処理中にエラーが発生しました");
    });

    it("正常結果とエラー結果が混在する場合も適切に保存できる", async () => {
      const reviewingTarget = createApiReviewingTarget();
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        reviewingTarget,
      );
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);

      const command: SaveApiReviewResultsCommand = {
        reviewTargetId: reviewingTarget.id.value,
        userId: testUserId,
        results: [
          {
            checkListItemId: testCheckListItemId1,
            checkListItemContent: "チェック項目1",
            evaluation: "A",
            comment: "問題ありません",
          },
          {
            checkListItemId: testCheckListItemId2,
            checkListItemContent: "チェック項目2",
            evaluation: "",
            comment: "",
            error: "外部APIからエラーが返されました",
          },
        ],
        chunkIndex: 0,
        totalChunks: 2,
      };

      const result = await service.execute(command);

      // 結果の検証
      expect(result.savedCount).toBe(2);

      // 保存されたレビュー結果の検証
      const savedResults = vi.mocked(mockReviewResultRepository.saveMany).mock.calls[0][0] as ReviewResult[];
      expect(savedResults).toHaveLength(2);

      // 1つ目は成功
      expect(savedResults[0].isSuccess()).toBe(true);
      expect(savedResults[0].evaluation?.value).toBe("A");
      expect(savedResults[0].comment?.value).toBe("問題ありません");

      // 2つ目はエラー
      expect(savedResults[1].isError()).toBe(true);
      expect(savedResults[1].errorMessage).toBe("外部APIからエラーが返されました");
    });
  });
});
