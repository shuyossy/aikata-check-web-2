import { describe, it, expect, vi, beforeEach } from "vitest";
import { GetChecklistGenerationTaskStatusService } from "../GetChecklistGenerationTaskStatusService";
import { IAiTaskRepository } from "@/application/shared/port/repository/IAiTaskRepository";
import { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import { IProjectRepository } from "@/application/shared/port/repository";
import { Project } from "@/domain/project";
import { ReviewSpace } from "@/domain/reviewSpace";
import { AiTask, AI_TASK_TYPE, AI_TASK_STATUS } from "@/domain/aiTask";

// 暗号化関数をモック
vi.mock("@/lib/server/encryption", () => ({
  encrypt: vi.fn((text: string) => `encrypted_${text}`),
  decrypt: vi.fn((text: string) => text.replace("encrypted_", "")),
}));

describe("GetChecklistGenerationTaskStatusService", () => {
  let mockAiTaskRepository: IAiTaskRepository;
  let mockReviewSpaceRepository: IReviewSpaceRepository;
  let mockProjectRepository: IProjectRepository;
  let service: GetChecklistGenerationTaskStatusService;

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
      deleteByReviewTargetId: vi.fn(),
      findChecklistGenerationTaskByReviewSpaceId: vi.fn().mockResolvedValue(null),
      deleteChecklistGenerationTaskByReviewSpaceId: vi.fn(),
    };
    mockReviewSpaceRepository = {
      findById: vi.fn().mockResolvedValue(mockReviewSpace),
      findByProjectId: vi.fn(),
      countByProjectId: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      updateChecklistGenerationError: vi.fn(),
    };
    mockProjectRepository = {
      findById: vi.fn().mockResolvedValue(mockProject),
      findByMemberId: vi.fn(),
      countByMemberId: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };
    service = new GetChecklistGenerationTaskStatusService(
      mockAiTaskRepository,
      mockReviewSpaceRepository,
      mockProjectRepository,
    );
  });

  describe("正常系", () => {
    it("タスクが存在しない場合はhasTask: falseを返す", async () => {
      const result = await service.execute({
        reviewSpaceId: validReviewSpaceId,
        userId: validUserId,
      });

      expect(result).toEqual({
        hasTask: false,
        status: null,
        taskId: null,
        errorMessage: null,
      });
    });

    it("キュー待機中のタスクが存在する場合はqueued状態を返す", async () => {
      vi.mocked(mockAiTaskRepository.findChecklistGenerationTaskByReviewSpaceId)
        .mockResolvedValue(mockQueuedTask);

      const result = await service.execute({
        reviewSpaceId: validReviewSpaceId,
        userId: validUserId,
      });

      expect(result).toEqual({
        hasTask: true,
        status: "queued",
        taskId: validTaskId,
        errorMessage: null,
      });
    });

    it("処理中のタスクが存在する場合はprocessing状態を返す", async () => {
      vi.mocked(mockAiTaskRepository.findChecklistGenerationTaskByReviewSpaceId)
        .mockResolvedValue(mockProcessingTask);

      const result = await service.execute({
        reviewSpaceId: validReviewSpaceId,
        userId: validUserId,
      });

      expect(result).toEqual({
        hasTask: true,
        status: "processing",
        taskId: validTaskId,
        errorMessage: null,
      });
    });

    it("レビュースペースにエラーメッセージがある場合はerrorMessageを返す", async () => {
      const mockReviewSpaceWithError = ReviewSpace.reconstruct({
        id: validReviewSpaceId,
        projectId: validProjectId,
        name: "テストスペース",
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        checklistGenerationError: "チェックリスト生成に失敗しました",
      });
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(mockReviewSpaceWithError);

      const result = await service.execute({
        reviewSpaceId: validReviewSpaceId,
        userId: validUserId,
      });

      expect(result).toEqual({
        hasTask: false,
        status: null,
        taskId: null,
        errorMessage: "チェックリスト生成に失敗しました",
      });
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
      vi.mocked(mockAiTaskRepository.findChecklistGenerationTaskByReviewSpaceId)
        .mockRejectedValue(new Error("DB Error"));

      await expect(
        service.execute({
          reviewSpaceId: validReviewSpaceId,
          userId: validUserId,
        }),
      ).rejects.toThrow("DB Error");
    });
  });
});
