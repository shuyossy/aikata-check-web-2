import { describe, it, expect, vi, beforeEach } from "vitest";
import { CancelChecklistGenerationTaskService } from "../CancelChecklistGenerationTaskService";
import { IAiTaskRepository } from "@/application/shared/port/repository/IAiTaskRepository";
import { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import { IProjectRepository } from "@/application/shared/port/repository";
import { Project } from "@/domain/project";
import { ReviewSpace } from "@/domain/reviewSpace";
import {
  AiTask,
  AI_TASK_TYPE,
  AI_TASK_STATUS,
  AiTaskId,
} from "@/domain/aiTask";
import { TaskFileHelper } from "@/lib/server/taskFileHelper";

// 暗号化関数をモック
vi.mock("@/lib/server/encryption", () => ({
  encrypt: vi.fn((text: string) => `encrypted_${text}`),
  decrypt: vi.fn((text: string) => text.replace("encrypted_", "")),
}));

// TaskFileHelperをモック
vi.mock("@/lib/server/taskFileHelper", () => ({
  TaskFileHelper: {
    deleteTaskFiles: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("CancelChecklistGenerationTaskService", () => {
  let mockAiTaskRepository: IAiTaskRepository;
  let mockReviewSpaceRepository: IReviewSpaceRepository;
  let mockProjectRepository: IProjectRepository;
  let service: CancelChecklistGenerationTaskService;

  const validProjectId = "123e4567-e89b-12d3-a456-426614174000";
  const validReviewSpaceId = "223e4567-e89b-12d3-a456-426614174001";
  const validUserId = "323e4567-e89b-12d3-a456-426614174002";
  const validTaskId = "423e4567-e89b-12d3-a456-426614174003";

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
    name: "テストスペース",
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const mockQueuedTask = AiTask.reconstruct({
    id: validTaskId,
    taskType: AI_TASK_TYPE.CHECKLIST_GENERATION,
    status: AI_TASK_STATUS.QUEUED,
    apiKeyHash: "test_hash",
    priority: 5,
    payload: { reviewSpaceId: validReviewSpaceId },
    errorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    startedAt: null,
    completedAt: null,
    fileMetadata: [],
  });

  const mockProcessingTask = AiTask.reconstruct({
    id: validTaskId,
    taskType: AI_TASK_TYPE.CHECKLIST_GENERATION,
    status: AI_TASK_STATUS.PROCESSING,
    apiKeyHash: "test_hash",
    priority: 5,
    payload: { reviewSpaceId: validReviewSpaceId },
    errorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    startedAt: new Date(),
    completedAt: null,
    fileMetadata: [],
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockAiTaskRepository = {
      findById: vi.fn(),
      findByStatus: vi.fn(),
      findByApiKeyHashAndStatus: vi.fn(),
      findDistinctApiKeyHashesInQueue: vi.fn(),
      countQueuedByApiKeyHash: vi.fn(),
      dequeueNextTask: vi.fn(),
      save: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined),
      deleteByStatus: vi.fn(),
      deleteByReviewTargetId: vi.fn(),
      findChecklistGenerationTaskByReviewSpaceId: vi
        .fn()
        .mockResolvedValue(mockQueuedTask),
      deleteChecklistGenerationTaskByReviewSpaceId: vi.fn(),
    };
    mockReviewSpaceRepository = {
      findById: vi.fn().mockResolvedValue(mockReviewSpace),
      findByProjectId: vi.fn(),
      countByProjectId: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      updateChecklistGenerationError: vi.fn().mockResolvedValue(undefined),
    };
    mockProjectRepository = {
      findById: vi.fn().mockResolvedValue(mockProject),
      findByMemberId: vi.fn(),
      countByMemberId: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };
    service = new CancelChecklistGenerationTaskService(
      mockAiTaskRepository,
      mockReviewSpaceRepository,
      mockProjectRepository,
    );
  });

  describe("正常系", () => {
    it("キュー待機中のタスクをキャンセルできる", async () => {
      await service.execute({
        reviewSpaceId: validReviewSpaceId,
        userId: validUserId,
      });

      // TaskFileHelper.deleteTaskFilesが呼ばれることを確認
      expect(TaskFileHelper.deleteTaskFiles).toHaveBeenCalledWith(validTaskId);

      // タスク削除が呼ばれることを確認
      expect(mockAiTaskRepository.delete).toHaveBeenCalledWith(
        expect.objectContaining({ value: validTaskId }),
      );
    });

    it("キュー待機中のタスクをキャンセルした場合、checklistGenerationErrorをクリアする", async () => {
      // Arrange
      mockReviewSpaceRepository.updateChecklistGenerationError = vi
        .fn()
        .mockResolvedValue(undefined);

      // Act
      await service.execute({
        reviewSpaceId: validReviewSpaceId,
        userId: validUserId,
      });

      // Assert
      // checklistGenerationErrorがクリア（nullで更新）されることを確認
      expect(
        mockReviewSpaceRepository.updateChecklistGenerationError,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ value: validReviewSpaceId }),
        null,
      );
    });
  });

  describe("異常系", () => {
    it("タスクが見つからない場合はエラー", async () => {
      vi.mocked(
        mockAiTaskRepository.findChecklistGenerationTaskByReviewSpaceId,
      ).mockResolvedValue(null);

      await expect(
        service.execute({
          reviewSpaceId: validReviewSpaceId,
          userId: validUserId,
        }),
      ).rejects.toMatchObject({ messageCode: "AI_TASK_NOT_FOUND" });
    });

    it("処理中のタスクはキャンセルできない", async () => {
      vi.mocked(
        mockAiTaskRepository.findChecklistGenerationTaskByReviewSpaceId,
      ).mockResolvedValue(mockProcessingTask);

      await expect(
        service.execute({
          reviewSpaceId: validReviewSpaceId,
          userId: validUserId,
        }),
      ).rejects.toMatchObject({
        messageCode: "AI_TASK_CANNOT_CANCEL_PROCESSING",
      });
    });

    it("存在しないレビュースペースの場合はエラー", async () => {
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(null);

      await expect(
        service.execute({
          reviewSpaceId: validReviewSpaceId,
          userId: validUserId,
        }),
      ).rejects.toMatchObject({ messageCode: "REVIEW_SPACE_NOT_FOUND" });
    });

    it("存在しないプロジェクトの場合はエラー", async () => {
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(null);

      await expect(
        service.execute({
          reviewSpaceId: validReviewSpaceId,
          userId: validUserId,
        }),
      ).rejects.toMatchObject({ messageCode: "PROJECT_NOT_FOUND" });
    });

    it("プロジェクトにアクセス権がない場合はエラー", async () => {
      const otherUserId = "623e4567-e89b-12d3-a456-426614174005";

      await expect(
        service.execute({
          reviewSpaceId: validReviewSpaceId,
          userId: otherUserId,
        }),
      ).rejects.toMatchObject({ messageCode: "PROJECT_ACCESS_DENIED" });
    });

    it("リポジトリでエラーが発生した場合はスロー", async () => {
      vi.mocked(mockAiTaskRepository.delete).mockRejectedValue(
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
});
