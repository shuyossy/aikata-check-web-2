import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ListReviewTargetsService,
  type ListReviewTargetsCommand,
} from "../ListReviewTargetsService";
import type { IReviewTargetRepository } from "@/application/shared/port/repository/IReviewTargetRepository";
import type { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import type { IProjectRepository } from "@/application/shared/port/repository";
import { ReviewSpace } from "@/domain/reviewSpace";
import { Project } from "@/domain/project";
import { ReviewTarget } from "@/domain/reviewTarget";

describe("ListReviewTargetsService", () => {
  // モックリポジトリ
  const mockReviewTargetRepository: IReviewTargetRepository = {
    findById: vi.fn(),
    findByReviewSpaceId: vi.fn(),
    countByReviewSpaceId: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
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

  let service: ListReviewTargetsService;

  // テスト用データ（有効なUUID v4形式）
  const testProjectId = "550e8400-e29b-41d4-a716-446655440001";
  const testReviewSpaceId = "550e8400-e29b-41d4-a716-446655440002";
  const testUserId = "550e8400-e29b-41d4-a716-446655440003";
  const testReviewTargetId1 = "550e8400-e29b-41d4-a716-446655440004";
  const testReviewTargetId2 = "550e8400-e29b-41d4-a716-446655440005";
  const testReviewTargetId3 = "550e8400-e29b-41d4-a716-446655440006";

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

  const testReviewTargets = [
    ReviewTarget.reconstruct({
      id: testReviewTargetId1,
      reviewSpaceId: testReviewSpaceId,
      name: "レビュー対象1",
      status: "completed",
      reviewType: null,
      reviewSettings: null,
      createdAt: now,
      updatedAt: now,
    }),
    ReviewTarget.reconstruct({
      id: testReviewTargetId2,
      reviewSpaceId: testReviewSpaceId,
      name: "レビュー対象2",
      status: "reviewing",
      reviewType: null,
      reviewSettings: null,
      createdAt: now,
      updatedAt: now,
    }),
    ReviewTarget.reconstruct({
      id: testReviewTargetId3,
      reviewSpaceId: testReviewSpaceId,
      name: "レビュー対象3",
      status: "error",
      reviewType: null,
      reviewSettings: null,
      createdAt: now,
      updatedAt: now,
    }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ListReviewTargetsService(
      mockReviewTargetRepository,
      mockReviewSpaceRepository,
      mockProjectRepository,
    );
  });

  describe("正常系", () => {
    it("レビュー対象一覧を取得できる（複数件）", async () => {
      // モックの設定
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(mockReviewTargetRepository.findByReviewSpaceId).mockResolvedValue(
        testReviewTargets,
      );

      const command: ListReviewTargetsCommand = {
        reviewSpaceId: testReviewSpaceId,
        userId: testUserId,
      };

      const result = await service.execute(command);

      expect(result.reviewTargets).toHaveLength(3);
      expect(result.totalCount).toBe(3);
      expect(result.reviewTargets[0].id).toBe(testReviewTargetId1);
      expect(result.reviewTargets[0].name).toBe("レビュー対象1");
      expect(result.reviewTargets[0].status).toBe("completed");
      expect(result.reviewTargets[1].status).toBe("reviewing");
      expect(result.reviewTargets[2].status).toBe("error");
    });

    it("空の一覧を取得できる（0件）", async () => {
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(mockReviewTargetRepository.findByReviewSpaceId).mockResolvedValue(
        [],
      );

      const command: ListReviewTargetsCommand = {
        reviewSpaceId: testReviewSpaceId,
        userId: testUserId,
      };

      const result = await service.execute(command);

      expect(result.reviewTargets).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });

    it("totalCountが正しく返される", async () => {
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(mockReviewTargetRepository.findByReviewSpaceId).mockResolvedValue(
        testReviewTargets,
      );

      const command: ListReviewTargetsCommand = {
        reviewSpaceId: testReviewSpaceId,
        userId: testUserId,
      };

      const result = await service.execute(command);

      expect(result.totalCount).toBe(testReviewTargets.length);
    });

    it("レビュー対象のDTOが正しい形式で返される", async () => {
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(mockReviewTargetRepository.findByReviewSpaceId).mockResolvedValue(
        [testReviewTargets[0]],
      );

      const command: ListReviewTargetsCommand = {
        reviewSpaceId: testReviewSpaceId,
        userId: testUserId,
      };

      const result = await service.execute(command);

      const dto = result.reviewTargets[0];
      expect(dto.id).toBe(testReviewTargetId1);
      expect(dto.name).toBe("レビュー対象1");
      expect(dto.status).toBe("completed");
      expect(dto.createdAt).toBe(now);
      expect(dto.updatedAt).toBe(now);
      // 一覧DTOにはreviewSpaceIdやreviewSettingsは含まれない
      expect((dto as unknown as Record<string, unknown>).reviewSpaceId).toBeUndefined();
      expect((dto as unknown as Record<string, unknown>).reviewSettings).toBeUndefined();
    });
  });

  describe("異常系", () => {
    it("レビュースペースが存在しない場合エラーになる", async () => {
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(null);

      const command: ListReviewTargetsCommand = {
        reviewSpaceId: testReviewSpaceId,
        userId: testUserId,
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "REVIEW_SPACE_NOT_FOUND",
      });
    });

    it("プロジェクトが存在しない場合エラーになる", async () => {
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(null);

      const command: ListReviewTargetsCommand = {
        reviewSpaceId: testReviewSpaceId,
        userId: testUserId,
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "PROJECT_NOT_FOUND",
      });
    });

    it("アクセス権がない場合エラーになる", async () => {
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);

      // メンバーではないユーザー
      const nonMemberUserId = "550e8400-e29b-41d4-a716-446655440099";
      const command: ListReviewTargetsCommand = {
        reviewSpaceId: testReviewSpaceId,
        userId: nonMemberUserId,
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "PROJECT_ACCESS_DENIED",
      });
    });
  });
});
