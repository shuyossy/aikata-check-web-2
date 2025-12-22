import { describe, it, expect, vi, beforeEach } from "vitest";
import { DeleteProjectService } from "../DeleteProjectService";
import {
  IProjectRepository,
  IAiTaskRepository,
} from "@/application/shared/port/repository";
import { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import { IReviewTargetRepository } from "@/application/shared/port/repository/IReviewTargetRepository";
import type { IWorkflowRunRegistry } from "@/application/aiTask/WorkflowRunRegistry";
import { Project } from "@/domain/project";
import { ReviewSpace } from "@/domain/reviewSpace";
import { ReviewTarget } from "@/domain/reviewTarget";
import { AiTask } from "@/domain/aiTask";
import { TaskFileHelper } from "@/lib/server/taskFileHelper";
import { ReviewCacheHelper } from "@/lib/server/reviewCacheHelper";

// 暗号化関数をモック
vi.mock("@/lib/server/encryption", () => ({
  encrypt: vi.fn((text: string) => `encrypted_${text}`),
  decrypt: vi.fn((text: string) => text.replace("encrypted_", "")),
}));

// TaskFileHelperのモック
vi.mock("@/lib/server/taskFileHelper", () => ({
  TaskFileHelper: {
    deleteTaskFiles: vi.fn().mockResolvedValue(undefined),
  },
}));

// ReviewCacheHelperのモック
vi.mock("@/lib/server/reviewCacheHelper", () => ({
  ReviewCacheHelper: {
    deleteCacheDirectory: vi.fn().mockResolvedValue(undefined),
  },
}));

// ロガーのモック
vi.mock("@/lib/server/logger", () => ({
  getLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe("DeleteProjectService", () => {
  let mockProjectRepository: IProjectRepository;
  let service: DeleteProjectService;

  const validProjectId = "323e4567-e89b-12d3-a456-426614174002";
  const validMemberId = "123e4567-e89b-12d3-a456-426614174000";
  const nonMemberId = "223e4567-e89b-12d3-a456-426614174001";

  const createMockProject = () => {
    const now = new Date();
    return Project.reconstruct({
      id: validProjectId,
      name: "テストプロジェクト",
      description: null,
      encryptedApiKey: null,
      members: [{ userId: validMemberId, createdAt: now }],
      createdAt: now,
      updatedAt: now,
    });
  };

  beforeEach(() => {
    mockProjectRepository = {
      findById: vi.fn(),
      findByMemberId: vi.fn(),
      countByMemberId: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };
    service = new DeleteProjectService(mockProjectRepository);
  });

  describe("正常系", () => {
    it("プロジェクトを削除できる", async () => {
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(
        createMockProject(),
      );

      await service.execute({
        projectId: validProjectId,
        userId: validMemberId,
      });

      expect(mockProjectRepository.delete).toHaveBeenCalledTimes(1);
    });
  });

  describe("異常系", () => {
    it("プロジェクトが存在しない場合はエラー", async () => {
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(null);

      await expect(
        service.execute({
          projectId: validProjectId,
          userId: validMemberId,
        }),
      ).rejects.toMatchObject({ messageCode: "PROJECT_NOT_FOUND" });
    });

    it("メンバーでないユーザは削除できない", async () => {
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(
        createMockProject(),
      );

      await expect(
        service.execute({
          projectId: validProjectId,
          userId: nonMemberId,
        }),
      ).rejects.toMatchObject({ messageCode: "PROJECT_ACCESS_DENIED" });
    });

    it("プロジェクトIDが不正な形式の場合はエラー", async () => {
      await expect(
        service.execute({
          projectId: "invalid-id",
          userId: validMemberId,
        }),
      ).rejects.toMatchObject({ messageCode: "PROJECT_ID_INVALID_FORMAT" });
    });
  });

  describe("カスケードクリーンアップ", () => {
    const validReviewSpaceId = "423e4567-e89b-12d3-a456-426614174003";
    const validReviewTargetId = "523e4567-e89b-12d3-a456-426614174004";
    const validAiTaskId = "623e4567-e89b-12d3-a456-426614174005";
    const now = new Date();

    const mockReviewSpace = ReviewSpace.reconstruct({
      id: validReviewSpaceId,
      projectId: validProjectId,
      name: "テストスペース",
      description: null,
      createdAt: now,
      updatedAt: now,
    });

    const mockReviewTarget = ReviewTarget.reconstruct({
      id: validReviewTargetId,
      reviewSpaceId: validReviewSpaceId,
      name: "テストレビュー対象",
      status: "completed",
      reviewType: "small",
      reviewSettings: null,
      createdAt: now,
      updatedAt: now,
    });

    const createMockAiTask = (status: string) =>
      AiTask.reconstruct({
        id: validAiTaskId,
        taskType: "small_review",
        status,
        apiKeyHash: "test-api-key-hash",
        priority: 1,
        payload: { reviewTargetId: validReviewTargetId },
        errorMessage: null,
        createdAt: now,
        updatedAt: now,
        startedAt: null,
        completedAt: null,
        fileMetadata: [],
      });

    let mockReviewSpaceRepository: IReviewSpaceRepository;
    let mockReviewTargetRepository: IReviewTargetRepository;
    let mockAiTaskRepository: IAiTaskRepository;
    let mockWorkflowRunRegistry: IWorkflowRunRegistry;
    let serviceWithCleanup: DeleteProjectService;

    beforeEach(() => {
      mockReviewSpaceRepository = {
        findById: vi.fn(),
        findByProjectId: vi.fn().mockResolvedValue([mockReviewSpace]),
        countByProjectId: vi.fn(),
        save: vi.fn(),
        delete: vi.fn(),
      };

      mockReviewTargetRepository = {
        findById: vi.fn(),
        findByReviewSpaceId: vi.fn().mockResolvedValue([mockReviewTarget]),
        countByReviewSpaceId: vi.fn(),
        save: vi.fn(),
        delete: vi.fn(),
      };

      mockAiTaskRepository = {
        findById: vi.fn(),
        findByStatus: vi.fn(),
        findByApiKeyHashAndStatus: vi.fn(),
        findDistinctApiKeyHashesInQueue: vi.fn(),
        countQueuedByApiKeyHash: vi.fn(),
        dequeueNextTask: vi.fn(),
        save: vi.fn(),
        delete: vi.fn(),
        deleteByStatus: vi.fn(),
        findByReviewTargetId: vi.fn().mockResolvedValue(null),
        deleteByReviewTargetId: vi.fn(),
        findChecklistGenerationTaskByReviewSpaceId: vi
          .fn()
          .mockResolvedValue(null),
        deleteChecklistGenerationTaskByReviewSpaceId: vi.fn(),
      };

      mockWorkflowRunRegistry = {
        register: vi.fn(),
        deregister: vi.fn(),
        cancel: vi.fn().mockResolvedValue(true),
        isRegistered: vi.fn(),
        isCancelling: vi.fn(),
        setCancelling: vi.fn(),
      };

      serviceWithCleanup = new DeleteProjectService(
        mockProjectRepository,
        mockReviewSpaceRepository,
        mockReviewTargetRepository,
        mockAiTaskRepository,
        mockWorkflowRunRegistry,
      );
    });

    it("プロジェクト削除時に全レビュースペースのレビュー対象がクリーンアップされる", async () => {
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(
        createMockProject(),
      );

      await serviceWithCleanup.execute({
        projectId: validProjectId,
        userId: validMemberId,
      });

      // レビュースペースが取得されたことを確認
      expect(mockReviewSpaceRepository.findByProjectId).toHaveBeenCalled();
      // レビュー対象が取得されたことを確認
      expect(mockReviewTargetRepository.findByReviewSpaceId).toHaveBeenCalled();
      // キャッシュ削除が呼ばれたことを確認
      expect(ReviewCacheHelper.deleteCacheDirectory).toHaveBeenCalledWith(
        validReviewTargetId,
      );
      expect(mockProjectRepository.delete).toHaveBeenCalledTimes(1);
    });

    it("PROCESSING状態のAIタスクがある場合、ワークフローがキャンセルされる", async () => {
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(
        createMockProject(),
      );
      vi.mocked(mockAiTaskRepository.findByReviewTargetId).mockResolvedValue(
        createMockAiTask("processing"),
      );

      await serviceWithCleanup.execute({
        projectId: validProjectId,
        userId: validMemberId,
      });

      // ワークフローキャンセルが呼ばれたことを確認
      expect(mockWorkflowRunRegistry.setCancelling).toHaveBeenCalledWith(true);
      expect(mockWorkflowRunRegistry.cancel).toHaveBeenCalledWith(
        validAiTaskId,
      );
      expect(mockWorkflowRunRegistry.setCancelling).toHaveBeenCalledWith(false);
      // タスクファイルとAIタスクが削除されたことを確認
      expect(TaskFileHelper.deleteTaskFiles).toHaveBeenCalledWith(
        validAiTaskId,
      );
      expect(mockAiTaskRepository.deleteByReviewTargetId).toHaveBeenCalledWith(
        validReviewTargetId,
      );
    });

    it("複数のレビュースペースがある場合、全てクリーンアップされる", async () => {
      const reviewSpace2Id = "723e4567-e89b-12d3-a456-426614174006";
      const reviewTarget2Id = "823e4567-e89b-12d3-a456-426614174007";

      const mockReviewSpace2 = ReviewSpace.reconstruct({
        id: reviewSpace2Id,
        projectId: validProjectId,
        name: "テストスペース2",
        description: null,
        createdAt: now,
        updatedAt: now,
      });

      const mockReviewTarget2 = ReviewTarget.reconstruct({
        id: reviewTarget2Id,
        reviewSpaceId: reviewSpace2Id,
        name: "テストレビュー対象2",
        status: "completed",
        reviewType: "small",
        reviewSettings: null,
        createdAt: now,
        updatedAt: now,
      });

      vi.mocked(mockProjectRepository.findById).mockResolvedValue(
        createMockProject(),
      );
      vi.mocked(mockReviewSpaceRepository.findByProjectId).mockResolvedValue([
        mockReviewSpace,
        mockReviewSpace2,
      ]);
      vi.mocked(mockReviewTargetRepository.findByReviewSpaceId)
        .mockResolvedValueOnce([mockReviewTarget])
        .mockResolvedValueOnce([mockReviewTarget2]);

      await serviceWithCleanup.execute({
        projectId: validProjectId,
        userId: validMemberId,
      });

      // 両方のレビュー対象のキャッシュが削除されたことを確認
      expect(ReviewCacheHelper.deleteCacheDirectory).toHaveBeenCalledWith(
        validReviewTargetId,
      );
      expect(ReviewCacheHelper.deleteCacheDirectory).toHaveBeenCalledWith(
        reviewTarget2Id,
      );
    });

    it("クリーンアップエラーが発生しても削除処理は続行される", async () => {
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(
        createMockProject(),
      );
      vi.mocked(ReviewCacheHelper.deleteCacheDirectory).mockRejectedValue(
        new Error("キャッシュ削除失敗"),
      );

      await serviceWithCleanup.execute({
        projectId: validProjectId,
        userId: validMemberId,
      });

      // エラーにならずプロジェクト削除が実行される
      expect(mockProjectRepository.delete).toHaveBeenCalledTimes(1);
    });

    it("複数のPROCESSING状態タスクが順次キャンセルされる", async () => {
      const reviewSpace2Id = "723e4567-e89b-12d3-a456-426614174006";
      const reviewTarget2Id = "823e4567-e89b-12d3-a456-426614174007";
      const aiTask2Id = "923e4567-e89b-12d3-a456-426614174008";

      const mockReviewSpace2 = ReviewSpace.reconstruct({
        id: reviewSpace2Id,
        projectId: validProjectId,
        name: "テストスペース2",
        description: null,
        createdAt: now,
        updatedAt: now,
      });

      const mockReviewTarget2 = ReviewTarget.reconstruct({
        id: reviewTarget2Id,
        reviewSpaceId: reviewSpace2Id,
        name: "テストレビュー対象2",
        status: "reviewing",
        reviewType: "large",
        reviewSettings: null,
        createdAt: now,
        updatedAt: now,
      });

      const processingTask1 = createMockAiTask("processing");
      const processingTask2 = AiTask.reconstruct({
        id: aiTask2Id,
        taskType: "large_review",
        status: "processing",
        apiKeyHash: "test-api-key-hash",
        priority: 1,
        payload: { reviewTargetId: reviewTarget2Id },
        errorMessage: null,
        createdAt: now,
        updatedAt: now,
        startedAt: now,
        completedAt: null,
        fileMetadata: [],
      });

      vi.mocked(mockProjectRepository.findById).mockResolvedValue(
        createMockProject(),
      );
      vi.mocked(mockReviewSpaceRepository.findByProjectId).mockResolvedValue([
        mockReviewSpace,
        mockReviewSpace2,
      ]);
      vi.mocked(mockReviewTargetRepository.findByReviewSpaceId)
        .mockResolvedValueOnce([mockReviewTarget])
        .mockResolvedValueOnce([mockReviewTarget2]);
      vi.mocked(mockAiTaskRepository.findByReviewTargetId)
        .mockResolvedValueOnce(processingTask1)
        .mockResolvedValueOnce(processingTask2);

      await serviceWithCleanup.execute({
        projectId: validProjectId,
        userId: validMemberId,
      });

      // 両方のワークフローがキャンセルされたことを確認
      expect(mockWorkflowRunRegistry.cancel).toHaveBeenCalledWith(
        validAiTaskId,
      );
      expect(mockWorkflowRunRegistry.cancel).toHaveBeenCalledWith(aiTask2Id);
      expect(mockWorkflowRunRegistry.cancel).toHaveBeenCalledTimes(2);

      // setCancellingが各キャンセルごとにtrue/falseで呼ばれたことを確認
      expect(mockWorkflowRunRegistry.setCancelling).toHaveBeenCalledWith(true);
      expect(mockWorkflowRunRegistry.setCancelling).toHaveBeenCalledWith(false);
      expect(mockWorkflowRunRegistry.setCancelling).toHaveBeenCalledTimes(4);

      // 両方のタスクファイルが削除されたことを確認
      expect(TaskFileHelper.deleteTaskFiles).toHaveBeenCalledWith(
        validAiTaskId,
      );
      expect(TaskFileHelper.deleteTaskFiles).toHaveBeenCalledWith(aiTask2Id);

      // プロジェクト削除が実行されたことを確認
      expect(mockProjectRepository.delete).toHaveBeenCalledTimes(1);
    });
  });
});
