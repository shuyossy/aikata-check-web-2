import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  GetReviewTargetService,
  type GetReviewTargetCommand,
} from "../GetReviewTargetService";
import type { IReviewTargetRepository } from "@/application/shared/port/repository/IReviewTargetRepository";
import type { IReviewResultRepository } from "@/application/shared/port/repository/IReviewResultRepository";
import type { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import type { IProjectRepository } from "@/application/shared/port/repository";
import { ReviewSpace } from "@/domain/reviewSpace";
import { Project } from "@/domain/project";
import { ReviewTarget } from "@/domain/reviewTarget";
import { ReviewResult } from "@/domain/reviewResult";
import { DEFAULT_EVALUATION_CRITERIA } from "@/domain/reviewSpace/EvaluationCriteria";

describe("GetReviewTargetService", () => {
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

  let service: GetReviewTargetService;

  // テスト用データ（有効なUUID v4形式）
  const testProjectId = "550e8400-e29b-41d4-a716-446655440001";
  const testReviewSpaceId = "550e8400-e29b-41d4-a716-446655440002";
  const testUserId = "550e8400-e29b-41d4-a716-446655440003";
  const testReviewTargetId = "550e8400-e29b-41d4-a716-446655440004";
  const testCheckListItemId1 = "550e8400-e29b-41d4-a716-446655440005";
  const testCheckListItemId2 = "550e8400-e29b-41d4-a716-446655440006";
  const testReviewResultId1 = "550e8400-e29b-41d4-a716-446655440007";
  const testReviewResultId2 = "550e8400-e29b-41d4-a716-446655440008";

  const now = new Date();

  const testProject = Project.reconstruct({
    id: testProjectId,
    name: "テストプロジェクト",
    description: null,
    encryptedApiKey: null,
    members: [{ userId: testUserId, createdAt: now }],
    createdAt: now,
    updatedAt: now,
  });

  const testReviewSpace = ReviewSpace.reconstruct({
    id: testReviewSpaceId,
    projectId: testProjectId,
    name: "テストスペース",
    description: null,
    createdAt: now,
    updatedAt: now,
  });

  const testReviewTarget = ReviewTarget.reconstruct({
    id: testReviewTargetId,
    reviewSpaceId: testReviewSpaceId,
    name: "テストレビュー対象",
    status: "completed",
    reviewSettings: {
      additionalInstructions: "テスト指示",
      concurrentReviewItems: 2,
      commentFormat: "【評価】",
      evaluationCriteria: DEFAULT_EVALUATION_CRITERIA,
    },
    createdAt: now,
    updatedAt: now,
  });

  const testReviewResults = [
    ReviewResult.reconstruct({
      id: testReviewResultId1,
      reviewTargetId: testReviewTargetId,
      checkListItemContent: "セキュリティ要件を満たしているか",
      evaluation: "A",
      comment: "問題ありません",
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    }),
    ReviewResult.reconstruct({
      id: testReviewResultId2,
      reviewTargetId: testReviewTargetId,
      checkListItemContent: "エラーハンドリングが適切か",
      evaluation: "B",
      comment: "一部改善が必要",
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GetReviewTargetService(
      mockReviewTargetRepository,
      mockReviewResultRepository,
      mockReviewSpaceRepository,
      mockProjectRepository,
    );
  });

  describe("正常系", () => {
    it("レビュー対象とレビュー結果を正しく取得してDTO変換する", async () => {
      // モックの設定
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        testReviewTarget,
      );
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(mockReviewResultRepository.findByReviewTargetId).mockResolvedValue(
        testReviewResults,
      );

      const command: GetReviewTargetCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
      };

      const result = await service.execute(command);

      expect(result.id).toBe(testReviewTargetId);
      expect(result.reviewSpaceId).toBe(testReviewSpaceId);
      expect(result.name).toBe("テストレビュー対象");
      expect(result.status).toBe("completed");
      expect(result.reviewSettings).not.toBeNull();
      expect(result.reviewSettings?.additionalInstructions).toBe("テスト指示");
      expect(result.reviewResults).toHaveLength(2);
      expect(result.reviewResults[0].evaluation).toBe("A");
      expect(result.reviewResults[1].evaluation).toBe("B");
      expect(result.createdAt).toBe(now);
      expect(result.updatedAt).toBe(now);
    });

    it("複数のレビュー結果がある場合、全て取得される", async () => {
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        testReviewTarget,
      );
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(mockReviewResultRepository.findByReviewTargetId).mockResolvedValue(
        testReviewResults,
      );

      const command: GetReviewTargetCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
      };

      const result = await service.execute(command);

      expect(result.reviewResults).toHaveLength(2);
      expect(result.reviewResults[0].id).toBe(testReviewResultId1);
      expect(result.reviewResults[0].checkListItemContent).toBe("セキュリティ要件を満たしているか");
      expect(result.reviewResults[1].id).toBe(testReviewResultId2);
      expect(result.reviewResults[1].checkListItemContent).toBe("エラーハンドリングが適切か");
    });

    it("レビュー設定がnullでも正しく取得できる", async () => {
      const targetWithoutSettings = ReviewTarget.reconstruct({
        id: testReviewTargetId,
        reviewSpaceId: testReviewSpaceId,
        name: "設定なしレビュー",
        status: "completed",
        reviewSettings: null,
        createdAt: now,
        updatedAt: now,
      });

      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        targetWithoutSettings,
      );
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(mockReviewResultRepository.findByReviewTargetId).mockResolvedValue(
        [],
      );

      const command: GetReviewTargetCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
      };

      const result = await service.execute(command);

      expect(result.reviewSettings).toBeNull();
      expect(result.reviewResults).toHaveLength(0);
    });
  });

  describe("異常系", () => {
    it("レビュー対象が存在しない場合エラーになる", async () => {
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(null);

      const command: GetReviewTargetCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "REVIEW_TARGET_NOT_FOUND",
      });
    });

    it("レビュースペースが存在しない場合エラーになる", async () => {
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        testReviewTarget,
      );
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(null);

      const command: GetReviewTargetCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "REVIEW_SPACE_NOT_FOUND",
      });
    });

    it("プロジェクトが存在しない場合エラーになる", async () => {
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        testReviewTarget,
      );
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(null);

      const command: GetReviewTargetCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "PROJECT_NOT_FOUND",
      });
    });

    it("アクセス権がない場合エラーになる", async () => {
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        testReviewTarget,
      );
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);

      // メンバーではないユーザー
      const nonMemberUserId = "550e8400-e29b-41d4-a716-446655440099";
      const command: GetReviewTargetCommand = {
        reviewTargetId: testReviewTargetId,
        userId: nonMemberUserId,
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "REVIEW_TARGET_ACCESS_DENIED",
      });
    });
  });
});
