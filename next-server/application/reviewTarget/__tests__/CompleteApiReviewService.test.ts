import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CompleteApiReviewService,
  type CompleteApiReviewCommand,
} from "../CompleteApiReviewService";
import type { IReviewTargetRepository } from "@/application/shared/port/repository/IReviewTargetRepository";
import type { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import type { IProjectRepository } from "@/application/shared/port/repository";
import { ReviewSpace } from "@/domain/reviewSpace";
import { Project } from "@/domain/project";
import { ReviewTarget } from "@/domain/reviewTarget";

describe("CompleteApiReviewService", () => {
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

  let service: CompleteApiReviewService;

  // テスト用データ（有効なUUID v4形式）
  const testProjectId = "550e8400-e29b-41d4-a716-446655440001";
  const testReviewSpaceId = "550e8400-e29b-41d4-a716-446655440002";
  const testUserId = "550e8400-e29b-41d4-a716-446655440003";
  const testReviewTargetId = "550e8400-e29b-41d4-a716-446655440010";

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
    service = new CompleteApiReviewService(
      mockReviewTargetRepository,
      mockReviewSpaceRepository,
      mockProjectRepository,
    );
  });

  describe("正常系", () => {
    it("外部APIレビューを正常完了できる（ステータスがcompletedになる）", async () => {
      const reviewingTarget = createApiReviewingTarget();
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        reviewingTarget,
      );
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);

      const command: CompleteApiReviewCommand = {
        reviewTargetId: reviewingTarget.id.value,
        userId: testUserId,
        hasError: false,
      };

      const result = await service.execute(command);

      // 結果の検証
      expect(result.reviewTargetId).toBe(reviewingTarget.id.value);
      expect(result.status).toBe("completed");

      // レビュー対象が保存されることを確認
      expect(mockReviewTargetRepository.save).toHaveBeenCalledTimes(1);

      // 保存されたReviewTargetのステータスがcompletedであることを確認
      const savedTarget = vi.mocked(mockReviewTargetRepository.save).mock
        .calls[0][0] as ReviewTarget;
      expect(savedTarget.status.isCompleted()).toBe(true);
    });

    it("外部APIレビューをエラー完了できる（ステータスがerrorになる）", async () => {
      const reviewingTarget = createApiReviewingTarget();
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        reviewingTarget,
      );
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);

      const command: CompleteApiReviewCommand = {
        reviewTargetId: reviewingTarget.id.value,
        userId: testUserId,
        hasError: true,
      };

      const result = await service.execute(command);

      // 結果の検証
      expect(result.reviewTargetId).toBe(reviewingTarget.id.value);
      expect(result.status).toBe("error");

      // 保存されたReviewTargetのステータスがerrorであることを確認
      const savedTarget = vi.mocked(mockReviewTargetRepository.save).mock
        .calls[0][0] as ReviewTarget;
      expect(savedTarget.status.isError()).toBe(true);
    });

    it("hasErrorがundefinedの場合、正常完了として扱う", async () => {
      const reviewingTarget = createApiReviewingTarget();
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        reviewingTarget,
      );
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);

      const command: CompleteApiReviewCommand = {
        reviewTargetId: reviewingTarget.id.value,
        userId: testUserId,
        // hasErrorを指定しない
      };

      const result = await service.execute(command);

      expect(result.status).toBe("completed");
    });
  });

  describe("異常系 - レビュー対象の検証", () => {
    it("レビュー対象が存在しない場合エラーになる", async () => {
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(null);

      const command: CompleteApiReviewCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
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

      const command: CompleteApiReviewCommand = {
        reviewTargetId: smallTarget.id.value,
        userId: testUserId,
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

      const command: CompleteApiReviewCommand = {
        reviewTargetId: completedTarget.id.value,
        userId: testUserId,
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

      const command: CompleteApiReviewCommand = {
        reviewTargetId: reviewingTarget.id.value,
        userId: testUserId,
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

      const command: CompleteApiReviewCommand = {
        reviewTargetId: reviewingTarget.id.value,
        userId: testUserId,
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
      const command: CompleteApiReviewCommand = {
        reviewTargetId: reviewingTarget.id.value,
        userId: nonMemberUserId,
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "PROJECT_ACCESS_DENIED",
      });
    });
  });
});
