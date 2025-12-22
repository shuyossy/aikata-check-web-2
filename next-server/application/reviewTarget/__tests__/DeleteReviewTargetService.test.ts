import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DeleteReviewTargetService,
  type DeleteReviewTargetCommand,
} from "../DeleteReviewTargetService";
import type { IReviewTargetRepository } from "@/application/shared/port/repository/IReviewTargetRepository";
import type { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import type {
  IProjectRepository,
  IAiTaskRepository,
} from "@/application/shared/port/repository";
import type { IWorkflowRunRegistry } from "@/application/aiTask/WorkflowRunRegistry";
import { ReviewSpace } from "@/domain/reviewSpace";
import { Project } from "@/domain/project";
import { ReviewTarget } from "@/domain/reviewTarget";
import { AiTask } from "@/domain/aiTask";
import { TaskFileHelper } from "@/lib/server/taskFileHelper";
import { ReviewCacheHelper } from "@/lib/server/reviewCacheHelper";

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

describe("DeleteReviewTargetService", () => {
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

  const mockAiTaskRepository: IAiTaskRepository = {
    findById: vi.fn(),
    findByStatus: vi.fn(),
    findByApiKeyHashAndStatus: vi.fn(),
    findDistinctApiKeyHashesInQueue: vi.fn(),
    countQueuedByApiKeyHash: vi.fn(),
    dequeueNextTask: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    deleteByStatus: vi.fn(),
    findByReviewTargetId: vi.fn(),
    deleteByReviewTargetId: vi.fn(),
    findChecklistGenerationTaskByReviewSpaceId: vi.fn(),
    deleteChecklistGenerationTaskByReviewSpaceId: vi.fn(),
  };

  let service: DeleteReviewTargetService;

  // テスト用データ（有効なUUID v4形式）
  const testProjectId = "550e8400-e29b-41d4-a716-446655440001";
  const testReviewSpaceId = "550e8400-e29b-41d4-a716-446655440002";
  const testUserId = "550e8400-e29b-41d4-a716-446655440003";
  const testReviewTargetId = "550e8400-e29b-41d4-a716-446655440004";

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

  const createTestReviewTarget = (status: string) =>
    ReviewTarget.reconstruct({
      id: testReviewTargetId,
      reviewSpaceId: testReviewSpaceId,
      name: "テストレビュー対象",
      status,
      reviewType: null,
      reviewSettings: null,
      createdAt: now,
      updatedAt: now,
    });

  const testAiTaskId = "550e8400-e29b-41d4-a716-446655440005";

  const createTestAiTask = () =>
    AiTask.reconstruct({
      id: testAiTaskId,
      taskType: "small_review",
      status: "queued",
      apiKeyHash: "test-api-key-hash",
      priority: 1,
      payload: { reviewTargetId: testReviewTargetId },
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
      fileMetadata: [],
    });

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DeleteReviewTargetService(
      mockReviewTargetRepository,
      mockReviewSpaceRepository,
      mockProjectRepository,
      mockAiTaskRepository,
    );
  });

  describe("正常系", () => {
    it("completed状態のレビュー対象を削除できる（AIタスクなし）", async () => {
      // モックの設定
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        createTestReviewTarget("completed"),
      );
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(mockAiTaskRepository.findByReviewTargetId).mockResolvedValue(
        null,
      );

      const command: DeleteReviewTargetCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
      };

      // エラーなく完了する
      await expect(service.execute(command)).resolves.toBeUndefined();
      // AIタスクが見つからない場合、ファイル削除とタスク削除は呼ばれない
      expect(TaskFileHelper.deleteTaskFiles).not.toHaveBeenCalled();
      expect(
        mockAiTaskRepository.deleteByReviewTargetId,
      ).not.toHaveBeenCalled();
      expect(mockReviewTargetRepository.delete).toHaveBeenCalledTimes(1);
    });

    it("AIタスクが存在する場合、関連ファイルとタスクが削除される", async () => {
      // モックの設定
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        createTestReviewTarget("queued"),
      );
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(mockAiTaskRepository.findByReviewTargetId).mockResolvedValue(
        createTestAiTask(),
      );

      const command: DeleteReviewTargetCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
      };

      // エラーなく完了する
      await expect(service.execute(command)).resolves.toBeUndefined();
      // AIタスクが存在する場合、ファイル削除とタスク削除が呼ばれる
      expect(TaskFileHelper.deleteTaskFiles).toHaveBeenCalledWith(testAiTaskId);
      expect(mockAiTaskRepository.deleteByReviewTargetId).toHaveBeenCalledWith(
        testReviewTargetId,
      );
      expect(mockReviewTargetRepository.delete).toHaveBeenCalledTimes(1);
    });

    it("error状態のレビュー対象を削除できる", async () => {
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        createTestReviewTarget("error"),
      );
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(mockAiTaskRepository.findByReviewTargetId).mockResolvedValue(
        null,
      );

      const command: DeleteReviewTargetCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
      };

      await expect(service.execute(command)).resolves.toBeUndefined();
      expect(mockReviewTargetRepository.delete).toHaveBeenCalledTimes(1);
    });

    it("pending状態のレビュー対象を削除できる", async () => {
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        createTestReviewTarget("pending"),
      );
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(mockAiTaskRepository.findByReviewTargetId).mockResolvedValue(
        null,
      );

      const command: DeleteReviewTargetCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
      };

      await expect(service.execute(command)).resolves.toBeUndefined();
      expect(mockReviewTargetRepository.delete).toHaveBeenCalledTimes(1);
    });

    it("reviewing状態のレビュー対象も削除できる（現在の実装では制限なし）", async () => {
      // 注: 現在のDeleteReviewTargetServiceにはcanDelete()チェックが実装されていない
      // そのため、reviewing状態でも削除可能
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        createTestReviewTarget("reviewing"),
      );
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(mockAiTaskRepository.findByReviewTargetId).mockResolvedValue(
        null,
      );

      const command: DeleteReviewTargetCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
      };

      await expect(service.execute(command)).resolves.toBeUndefined();
      expect(mockReviewTargetRepository.delete).toHaveBeenCalledTimes(1);
    });

    it("queued状態のレビュー対象を削除するとAIタスクとファイルも削除される", async () => {
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        createTestReviewTarget("queued"),
      );
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(mockAiTaskRepository.findByReviewTargetId).mockResolvedValue(
        createTestAiTask(),
      );

      const command: DeleteReviewTargetCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
      };

      await expect(service.execute(command)).resolves.toBeUndefined();
      // キュー待機中のAIタスクに紐づくファイルが削除される
      expect(TaskFileHelper.deleteTaskFiles).toHaveBeenCalledWith(testAiTaskId);
      // AIタスクが削除される
      expect(mockAiTaskRepository.deleteByReviewTargetId).toHaveBeenCalledWith(
        testReviewTargetId,
      );
      expect(mockReviewTargetRepository.delete).toHaveBeenCalledTimes(1);
    });
  });

  describe("異常系", () => {
    it("レビュー対象が存在しない場合エラーになる", async () => {
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(null);

      const command: DeleteReviewTargetCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "REVIEW_TARGET_NOT_FOUND",
      });

      expect(mockReviewTargetRepository.delete).not.toHaveBeenCalled();
    });

    it("レビュースペースが存在しない場合エラーになる", async () => {
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        createTestReviewTarget("completed"),
      );
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(null);

      const command: DeleteReviewTargetCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "REVIEW_SPACE_NOT_FOUND",
      });

      expect(mockReviewTargetRepository.delete).not.toHaveBeenCalled();
    });

    it("プロジェクトが存在しない場合エラーになる", async () => {
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        createTestReviewTarget("completed"),
      );
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(null);

      const command: DeleteReviewTargetCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "PROJECT_NOT_FOUND",
      });

      expect(mockReviewTargetRepository.delete).not.toHaveBeenCalled();
    });

    it("アクセス権がない場合エラーになる", async () => {
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        createTestReviewTarget("completed"),
      );
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);

      // メンバーではないユーザー
      const nonMemberUserId = "550e8400-e29b-41d4-a716-446655440099";
      const command: DeleteReviewTargetCommand = {
        reviewTargetId: testReviewTargetId,
        userId: nonMemberUserId,
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "REVIEW_TARGET_ACCESS_DENIED",
      });

      expect(mockReviewTargetRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe("WorkflowRunRegistry統合", () => {
    // モックWorkflowRunRegistry
    const mockWorkflowRunRegistry: IWorkflowRunRegistry = {
      register: vi.fn(),
      deregister: vi.fn(),
      cancel: vi.fn(),
      isRegistered: vi.fn(),
      isCancelling: vi.fn(),
      setCancelling: vi.fn(),
    };

    let serviceWithRegistry: DeleteReviewTargetService;

    const createProcessingAiTask = () =>
      AiTask.reconstruct({
        id: testAiTaskId,
        taskType: "small_review",
        status: "processing",
        apiKeyHash: "test-api-key-hash",
        priority: 1,
        payload: { reviewTargetId: testReviewTargetId },
        errorMessage: null,
        createdAt: now,
        updatedAt: now,
        startedAt: now,
        completedAt: null,
        fileMetadata: [],
      });

    beforeEach(() => {
      vi.clearAllMocks();
      serviceWithRegistry = new DeleteReviewTargetService(
        mockReviewTargetRepository,
        mockReviewSpaceRepository,
        mockProjectRepository,
        mockAiTaskRepository,
        mockWorkflowRunRegistry,
      );
    });

    it("PROCESSING状態のタスクがある場合、ワークフローがキャンセルされる", async () => {
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        createTestReviewTarget("reviewing"),
      );
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(mockAiTaskRepository.findByReviewTargetId).mockResolvedValue(
        createProcessingAiTask(),
      );
      vi.mocked(mockWorkflowRunRegistry.cancel).mockResolvedValue(true);

      const command: DeleteReviewTargetCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
      };

      await expect(
        serviceWithRegistry.execute(command),
      ).resolves.toBeUndefined();

      // キャンセル中フラグが設定・解除されることを確認
      expect(mockWorkflowRunRegistry.setCancelling).toHaveBeenNthCalledWith(
        1,
        true,
      );
      expect(mockWorkflowRunRegistry.setCancelling).toHaveBeenNthCalledWith(
        2,
        false,
      );
      // ワークフローがキャンセルされたことを確認
      expect(mockWorkflowRunRegistry.cancel).toHaveBeenCalledWith(testAiTaskId);
      // レビュー対象が削除されたことを確認
      expect(mockReviewTargetRepository.delete).toHaveBeenCalledTimes(1);
    });

    it("ワークフローキャンセルに失敗しても削除処理は続行される", async () => {
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        createTestReviewTarget("reviewing"),
      );
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(mockAiTaskRepository.findByReviewTargetId).mockResolvedValue(
        createProcessingAiTask(),
      );
      // キャンセルが失敗する
      vi.mocked(mockWorkflowRunRegistry.cancel).mockRejectedValue(
        new Error("キャンセル失敗"),
      );

      const command: DeleteReviewTargetCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
      };

      // エラーにならず削除処理が完了する
      await expect(
        serviceWithRegistry.execute(command),
      ).resolves.toBeUndefined();

      // キャンセル中フラグが最終的に解除されることを確認
      expect(mockWorkflowRunRegistry.setCancelling).toHaveBeenNthCalledWith(
        2,
        false,
      );
      // レビュー対象が削除されたことを確認
      expect(mockReviewTargetRepository.delete).toHaveBeenCalledTimes(1);
    });

    it("QUEUED状態のタスクの場合、ワークフローキャンセルは呼ばれない", async () => {
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        createTestReviewTarget("queued"),
      );
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(mockAiTaskRepository.findByReviewTargetId).mockResolvedValue(
        createTestAiTask(), // status: "queued"
      );

      const command: DeleteReviewTargetCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
      };

      await expect(
        serviceWithRegistry.execute(command),
      ).resolves.toBeUndefined();

      // QUEUED状態なのでワークフローキャンセルは呼ばれない
      expect(mockWorkflowRunRegistry.cancel).not.toHaveBeenCalled();
      expect(mockWorkflowRunRegistry.setCancelling).not.toHaveBeenCalled();
      // ファイル・タスク削除は呼ばれる
      expect(TaskFileHelper.deleteTaskFiles).toHaveBeenCalledWith(testAiTaskId);
      expect(mockAiTaskRepository.deleteByReviewTargetId).toHaveBeenCalledWith(
        testReviewTargetId,
      );
      expect(mockReviewTargetRepository.delete).toHaveBeenCalledTimes(1);
    });
  });

  describe("キャッシュ削除", () => {
    it("レビュー対象削除時にキャッシュディレクトリも削除される", async () => {
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        createTestReviewTarget("completed"),
      );
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(mockAiTaskRepository.findByReviewTargetId).mockResolvedValue(
        null,
      );

      const command: DeleteReviewTargetCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
      };

      await expect(service.execute(command)).resolves.toBeUndefined();

      // キャッシュディレクトリが削除されたことを確認
      expect(ReviewCacheHelper.deleteCacheDirectory).toHaveBeenCalledWith(
        testReviewTargetId,
      );
      expect(mockReviewTargetRepository.delete).toHaveBeenCalledTimes(1);
    });

    it("キャッシュ削除に失敗しても削除処理は続行される", async () => {
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        createTestReviewTarget("completed"),
      );
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(mockAiTaskRepository.findByReviewTargetId).mockResolvedValue(
        null,
      );
      // キャッシュ削除が失敗する
      vi.mocked(ReviewCacheHelper.deleteCacheDirectory).mockRejectedValue(
        new Error("キャッシュ削除失敗"),
      );

      const command: DeleteReviewTargetCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
      };

      // エラーにならず削除処理が完了する
      await expect(service.execute(command)).resolves.toBeUndefined();

      // レビュー対象が削除されたことを確認
      expect(mockReviewTargetRepository.delete).toHaveBeenCalledTimes(1);
    });
  });
});
