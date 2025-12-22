import { describe, it, expect, vi, beforeEach } from "vitest";
import { DeleteReviewSpaceService } from "../DeleteReviewSpaceService";
import { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import { IReviewTargetRepository } from "@/application/shared/port/repository/IReviewTargetRepository";
import {
  IProjectRepository,
  IAiTaskRepository,
} from "@/application/shared/port/repository";
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

describe("DeleteReviewSpaceService", () => {
  let mockReviewSpaceRepository: IReviewSpaceRepository;
  let mockProjectRepository: IProjectRepository;
  let service: DeleteReviewSpaceService;

  const validProjectId = "123e4567-e89b-12d3-a456-426614174000";
  const validUserId = "223e4567-e89b-12d3-a456-426614174001";
  const validReviewSpaceId = "323e4567-e89b-12d3-a456-426614174002";

  const mockProject = Project.reconstruct({
    id: validProjectId,
    name: "テストプロジェクト",
    description: "テスト説明",
    encryptedApiKey: null,
    members: [{ userId: validUserId, createdAt: new Date() }],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const mockReviewSpace = ReviewSpace.reconstruct({
    id: validReviewSpaceId,
    projectId: validProjectId,
    name: "設計書レビュー",
    description: "設計書のレビュー",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-06-01"),
  });

  beforeEach(() => {
    mockReviewSpaceRepository = {
      findById: vi.fn().mockResolvedValue(mockReviewSpace),
      findByProjectId: vi.fn(),
      countByProjectId: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };
    mockProjectRepository = {
      findById: vi.fn().mockResolvedValue(mockProject),
      findByMemberId: vi.fn(),
      countByMemberId: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };
    service = new DeleteReviewSpaceService(
      mockReviewSpaceRepository,
      mockProjectRepository,
    );
  });

  describe("正常系", () => {
    it("レビュースペースを削除できる", async () => {
      await service.execute({
        reviewSpaceId: validReviewSpaceId,
        userId: validUserId,
      });

      expect(mockReviewSpaceRepository.delete).toHaveBeenCalledTimes(1);
      expect(mockReviewSpaceRepository.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          _value: validReviewSpaceId,
        }),
      );
    });
  });

  describe("異常系", () => {
    it("存在しないレビュースペースの場合はエラー", async () => {
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(null);

      await expect(
        service.execute({
          reviewSpaceId: validReviewSpaceId,
          userId: validUserId,
        }),
      ).rejects.toMatchObject({ messageCode: "REVIEW_SPACE_NOT_FOUND" });
    });

    it("プロジェクトが存在しない場合はエラー", async () => {
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(null);

      await expect(
        service.execute({
          reviewSpaceId: validReviewSpaceId,
          userId: validUserId,
        }),
      ).rejects.toMatchObject({ messageCode: "PROJECT_NOT_FOUND" });
    });

    it("プロジェクトにアクセス権がない場合はエラー", async () => {
      const otherUserId = "423e4567-e89b-12d3-a456-426614174003";

      await expect(
        service.execute({
          reviewSpaceId: validReviewSpaceId,
          userId: otherUserId,
        }),
      ).rejects.toMatchObject({ messageCode: "PROJECT_ACCESS_DENIED" });
    });

    it("リポジトリでエラーが発生した場合はスロー", async () => {
      vi.mocked(mockReviewSpaceRepository.delete).mockRejectedValue(
        new Error("DB Error"),
      );

      await expect(
        service.execute({
          reviewSpaceId: validReviewSpaceId,
          userId: validUserId,
        }),
      ).rejects.toThrow("DB Error");
    });
  });

  describe("カスケードクリーンアップ", () => {
    const validReviewTargetId = "423e4567-e89b-12d3-a456-426614174003";
    const validAiTaskId = "523e4567-e89b-12d3-a456-426614174004";
    const now = new Date();

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

    let mockReviewTargetRepository: IReviewTargetRepository;
    let mockAiTaskRepository: IAiTaskRepository;
    let mockWorkflowRunRegistry: IWorkflowRunRegistry;
    let serviceWithCleanup: DeleteReviewSpaceService;

    beforeEach(() => {
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

      serviceWithCleanup = new DeleteReviewSpaceService(
        mockReviewSpaceRepository,
        mockProjectRepository,
        mockReviewTargetRepository,
        mockAiTaskRepository,
        mockWorkflowRunRegistry,
      );
    });

    it("レビュースペース削除時に全レビュー対象のキャッシュが削除される", async () => {
      await serviceWithCleanup.execute({
        reviewSpaceId: validReviewSpaceId,
        userId: validUserId,
      });

      // キャッシュ削除が呼ばれたことを確認
      expect(ReviewCacheHelper.deleteCacheDirectory).toHaveBeenCalledWith(
        validReviewTargetId,
      );
      expect(mockReviewSpaceRepository.delete).toHaveBeenCalledTimes(1);
    });

    it("PROCESSING状態のAIタスクがある場合、ワークフローがキャンセルされる", async () => {
      vi.mocked(mockAiTaskRepository.findByReviewTargetId).mockResolvedValue(
        createMockAiTask("processing"),
      );

      await serviceWithCleanup.execute({
        reviewSpaceId: validReviewSpaceId,
        userId: validUserId,
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

    it("QUEUED状態のAIタスクはワークフローキャンセルなしで削除される", async () => {
      vi.mocked(mockAiTaskRepository.findByReviewTargetId).mockResolvedValue(
        createMockAiTask("queued"),
      );

      await serviceWithCleanup.execute({
        reviewSpaceId: validReviewSpaceId,
        userId: validUserId,
      });

      // ワークフローキャンセルは呼ばれない
      expect(mockWorkflowRunRegistry.cancel).not.toHaveBeenCalled();
      // タスクファイルとAIタスクは削除される
      expect(TaskFileHelper.deleteTaskFiles).toHaveBeenCalledWith(
        validAiTaskId,
      );
      expect(mockAiTaskRepository.deleteByReviewTargetId).toHaveBeenCalledWith(
        validReviewTargetId,
      );
    });

    it("チェックリスト生成タスクがPROCESSING状態の場合もキャンセルされる", async () => {
      const checklistTaskId = "623e4567-e89b-12d3-a456-426614174005";
      const checklistTask = AiTask.reconstruct({
        id: checklistTaskId,
        taskType: "checklist_generation",
        status: "processing",
        apiKeyHash: "test-api-key-hash",
        priority: 1,
        payload: { reviewSpaceId: validReviewSpaceId },
        errorMessage: null,
        createdAt: now,
        updatedAt: now,
        startedAt: now,
        completedAt: null,
        fileMetadata: [],
      });

      vi.mocked(
        mockAiTaskRepository.findChecklistGenerationTaskByReviewSpaceId,
      ).mockResolvedValue(checklistTask);

      await serviceWithCleanup.execute({
        reviewSpaceId: validReviewSpaceId,
        userId: validUserId,
      });

      // チェックリスト生成ワークフローキャンセルが呼ばれたことを確認
      expect(mockWorkflowRunRegistry.cancel).toHaveBeenCalledWith(
        checklistTaskId,
      );
      expect(TaskFileHelper.deleteTaskFiles).toHaveBeenCalledWith(
        checklistTaskId,
      );
      expect(
        mockAiTaskRepository.deleteChecklistGenerationTaskByReviewSpaceId,
      ).toHaveBeenCalledWith(validReviewSpaceId);
    });

    it("クリーンアップエラーが発生しても削除処理は続行される", async () => {
      vi.mocked(ReviewCacheHelper.deleteCacheDirectory).mockRejectedValue(
        new Error("キャッシュ削除失敗"),
      );

      await serviceWithCleanup.execute({
        reviewSpaceId: validReviewSpaceId,
        userId: validUserId,
      });

      // エラーにならずレビュースペース削除が実行される
      expect(mockReviewSpaceRepository.delete).toHaveBeenCalledTimes(1);
    });
  });
});
