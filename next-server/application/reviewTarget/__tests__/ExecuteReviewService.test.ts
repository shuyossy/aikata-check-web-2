import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ExecuteReviewService,
  type ExecuteReviewCommand,
} from "../ExecuteReviewService";
import type { IReviewTargetRepository } from "@/application/shared/port/repository/IReviewTargetRepository";
import type { ICheckListItemRepository } from "@/application/shared/port/repository/ICheckListItemRepository";
import type { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import type {
  IProjectRepository,
  ISystemSettingRepository,
} from "@/application/shared/port/repository";
import { AiTaskQueueService } from "@/application/aiTask/AiTaskQueueService";
import { ReviewSpace } from "@/domain/reviewSpace";
import { Project } from "@/domain/project";
import { CheckListItem } from "@/domain/checkListItem";
import { AI_TASK_TYPE } from "@/domain/aiTask";
import type { RawUploadFileMeta, FileBuffersMap } from "@/application/mastra";

// vi.hoisted()でモック関数を定義（テスト間の分離のため）
const { mockResolveAiApiConfig } = vi.hoisted(() => {
  const mockResolveAiApiConfig = vi.fn().mockReturnValue({
    apiKey: "test-api-key",
    apiUrl: "https://api.example.com",
    apiModel: "test-model",
  });
  return { mockResolveAiApiConfig };
});

// resolveAiApiConfigのモック
vi.mock("@/application/shared/lib/resolveAiApiConfig", () => ({
  resolveAiApiConfig: mockResolveAiApiConfig,
}));

// AiTaskQueueServiceのモック
vi.mock("@/application/aiTask/AiTaskQueueService", () => ({
  AiTaskQueueService: vi.fn(),
}));

// AiTaskBootstrapのモック
vi.mock("@/application/aiTask", () => ({
  getAiTaskBootstrap: vi.fn(() => ({
    startWorkersForApiKeyHash: vi.fn(),
  })),
}));

describe("ExecuteReviewService", () => {
  // モックリポジトリ
  const mockReviewTargetRepository: IReviewTargetRepository = {
    findById: vi.fn(),
    findByReviewSpaceId: vi.fn(),
    countByReviewSpaceId: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };

  const mockCheckListItemRepository: ICheckListItemRepository = {
    findById: vi.fn(),
    findByIds: vi.fn(),
    findByReviewSpaceId: vi.fn(),
    countByReviewSpaceId: vi.fn(),
    save: vi.fn(),
    bulkSave: vi.fn(),
    bulkInsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    deleteByReviewSpaceId: vi.fn(),
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

  const mockSystemSettingRepository: ISystemSettingRepository = {
    find: vi.fn(),
    save: vi.fn(),
  };

  // モックAiTaskQueueService
  const mockEnqueueTask = vi.fn();
  const mockFindById = vi.fn();
  const mockAiTaskQueueService = {
    enqueueTask: mockEnqueueTask,
    findById: mockFindById,
    dequeueTask: vi.fn(),
    completeTask: vi.fn(),
    failTask: vi.fn(),
    getQueueLength: vi.fn(),
    findDistinctApiKeyHashesInQueue: vi.fn(),
    findProcessingTasks: vi.fn(),
  };

  let service: ExecuteReviewService;

  // テスト用データ（有効なUUID v4形式）
  const testProjectId = "550e8400-e29b-41d4-a716-446655440001";
  const testReviewSpaceId = "550e8400-e29b-41d4-a716-446655440002";
  const testUserId = "550e8400-e29b-41d4-a716-446655440003";
  const testEmployeeId = "test-employee-001";
  const testCheckListItemId1 = "550e8400-e29b-41d4-a716-446655440004";
  const testCheckListItemId2 = "550e8400-e29b-41d4-a716-446655440005";
  const testTaskId = "550e8400-e29b-41d4-a716-446655440006";
  const testApiKeyHash = "test-api-key-hash";

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

  const testCheckListItems = [
    CheckListItem.reconstruct({
      id: testCheckListItemId1,
      reviewSpaceId: testReviewSpaceId,
      content: "チェック項目1",
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    CheckListItem.reconstruct({
      id: testCheckListItemId2,
      reviewSpaceId: testReviewSpaceId,
      content: "チェック項目2",
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  ];

  // テスト用ファイルメタデータ（RawUploadFileMeta形式）
  const testFiles: RawUploadFileMeta[] = [
    {
      id: "file-1",
      name: "test.txt",
      type: "text/plain",
      size: 1000,
      processMode: "text",
    },
  ];

  // テスト用ファイルバッファ
  const createTestFileBuffers = (): FileBuffersMap => {
    const map: FileBuffersMap = new Map();
    map.set("file-1", {
      buffer: Buffer.from("テストドキュメントの内容"),
    });
    return map;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // resolveAiApiConfigのモックをデフォルト値にリセット
    mockResolveAiApiConfig.mockReturnValue({
      apiKey: "test-api-key",
      apiUrl: "https://api.example.com",
      apiModel: "test-model",
    });

    // モックの設定
    mockEnqueueTask.mockResolvedValue({
      taskId: testTaskId,
      queueLength: 1,
    });
    mockFindById.mockResolvedValue({
      id: testTaskId,
      apiKeyHash: testApiKeyHash,
    });

    // システム設定はデフォルトでnullを返す（環境変数を使用）
    vi.mocked(mockSystemSettingRepository.find).mockResolvedValue(null);

    service = new ExecuteReviewService(
      mockReviewTargetRepository,
      mockCheckListItemRepository,
      mockReviewSpaceRepository,
      mockProjectRepository,
      mockSystemSettingRepository,
      mockAiTaskQueueService as unknown as AiTaskQueueService,
    );
  });

  describe("正常系", () => {
    it("タスクがキューに登録され、ステータスがqueuedになる", async () => {
      // モックの設定
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(
        mockCheckListItemRepository.findByReviewSpaceId,
      ).mockResolvedValue(testCheckListItems);

      const command: ExecuteReviewCommand = {
        reviewSpaceId: testReviewSpaceId,
        name: "テストレビュー",
        userId: testUserId,
        employeeId: testEmployeeId,
        files: testFiles,
        fileBuffers: createTestFileBuffers(),
      };

      const result = await service.execute(command);

      expect(result.status).toBe("queued");
      expect(result.reviewTargetId).toBeTruthy();
      expect(result.queueLength).toBe(1);

      // レビュー対象が保存される（queued状態で1回）
      expect(mockReviewTargetRepository.save).toHaveBeenCalledTimes(1);

      // キューにタスクが登録される
      expect(mockEnqueueTask).toHaveBeenCalledTimes(1);
      expect(mockEnqueueTask).toHaveBeenCalledWith(
        expect.objectContaining({
          taskType: AI_TASK_TYPE.SMALL_REVIEW,
          apiKey: "test-api-key",
        }),
      );
    });

    it("大量レビュータイプでタスクが登録される", async () => {
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(
        mockCheckListItemRepository.findByReviewSpaceId,
      ).mockResolvedValue(testCheckListItems);

      const command: ExecuteReviewCommand = {
        reviewSpaceId: testReviewSpaceId,
        name: "テストレビュー",
        userId: testUserId,
        employeeId: testEmployeeId,
        files: testFiles,
        fileBuffers: createTestFileBuffers(),
        reviewType: "large",
      };

      const result = await service.execute(command);

      expect(result.status).toBe("queued");
      expect(mockEnqueueTask).toHaveBeenCalledWith(
        expect.objectContaining({
          taskType: AI_TASK_TYPE.LARGE_REVIEW,
        }),
      );
    });

    it("レビュー設定付きでタスクが登録される", async () => {
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(
        mockCheckListItemRepository.findByReviewSpaceId,
      ).mockResolvedValue(testCheckListItems);

      const command: ExecuteReviewCommand = {
        reviewSpaceId: testReviewSpaceId,
        name: "テストレビュー",
        userId: testUserId,
        employeeId: testEmployeeId,
        files: testFiles,
        fileBuffers: createTestFileBuffers(),
        reviewSettings: {
          additionalInstructions: "セキュリティに注意",
          concurrentReviewItems: 2,
          commentFormat: "【理由】",
          evaluationCriteria: [
            { label: "A", description: "優良" },
            { label: "B", description: "良好" },
          ],
        },
      };

      const result = await service.execute(command);

      expect(result.status).toBe("queued");

      // ペイロードにレビュー設定が含まれる
      const enqueueCall = mockEnqueueTask.mock.calls[0][0];
      expect(enqueueCall.payload.reviewSettings).toEqual({
        additionalInstructions: "セキュリティに注意",
        concurrentReviewItems: 2,
        commentFormat: "【理由】",
        evaluationCriteria: [
          { label: "A", description: "優良" },
          { label: "B", description: "良好" },
        ],
      });
    });
  });

  describe("異常系 - 入力バリデーション", () => {
    it("ファイルが空の場合エラーになる", async () => {
      const command: ExecuteReviewCommand = {
        reviewSpaceId: testReviewSpaceId,
        name: "テストレビュー",
        userId: testUserId,
        employeeId: testEmployeeId,
        files: [],
        fileBuffers: new Map(),
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "REVIEW_EXECUTION_NO_FILES",
      });
    });

    it("チェックリスト項目が空の場合エラーになる", async () => {
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(
        mockCheckListItemRepository.findByReviewSpaceId,
      ).mockResolvedValue([]);

      const command: ExecuteReviewCommand = {
        reviewSpaceId: testReviewSpaceId,
        name: "テストレビュー",
        userId: testUserId,
        employeeId: testEmployeeId,
        files: testFiles,
        fileBuffers: createTestFileBuffers(),
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "REVIEW_EXECUTION_NO_CHECKLIST",
      });
    });
  });

  describe("異常系 - 権限確認", () => {
    it("レビュースペースが存在しない場合エラーになる", async () => {
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(null);

      const command: ExecuteReviewCommand = {
        reviewSpaceId: testReviewSpaceId,
        name: "テストレビュー",
        userId: testUserId,
        employeeId: testEmployeeId,
        files: testFiles,
        fileBuffers: createTestFileBuffers(),
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

      const command: ExecuteReviewCommand = {
        reviewSpaceId: testReviewSpaceId,
        name: "テストレビュー",
        userId: testUserId,
        employeeId: testEmployeeId,
        files: testFiles,
        fileBuffers: createTestFileBuffers(),
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "PROJECT_NOT_FOUND",
      });
    });

    it("プロジェクトメンバーでない場合エラーになる", async () => {
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);

      // メンバーではないが有効なUUID形式のユーザーID
      const nonMemberUserId = "550e8400-e29b-41d4-a716-446655440099";
      const command: ExecuteReviewCommand = {
        reviewSpaceId: testReviewSpaceId,
        name: "テストレビュー",
        userId: nonMemberUserId,
        employeeId: testEmployeeId,
        files: testFiles,
        fileBuffers: createTestFileBuffers(),
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "PROJECT_ACCESS_DENIED",
      });
    });
  });

  describe("キュー登録", () => {
    it("ファイルバッファがFileInfoCommand配列に変換される", async () => {
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(
        mockCheckListItemRepository.findByReviewSpaceId,
      ).mockResolvedValue(testCheckListItems);

      const command: ExecuteReviewCommand = {
        reviewSpaceId: testReviewSpaceId,
        name: "テストレビュー",
        userId: testUserId,
        employeeId: testEmployeeId,
        files: testFiles,
        fileBuffers: createTestFileBuffers(),
      };

      await service.execute(command);

      // enqueueTaskに渡されるfilesを確認
      const enqueueCall = mockEnqueueTask.mock.calls[0][0];
      expect(enqueueCall.files).toHaveLength(1);
      expect(enqueueCall.files[0]).toMatchObject({
        fileId: "file-1",
        fileName: "test.txt",
        fileSize: 1000,
        mimeType: "text/plain",
      });
      expect(enqueueCall.files[0].buffer).toBeInstanceOf(Buffer);
    });

    it("ペイロードにチェックリスト項目が含まれる", async () => {
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(
        mockCheckListItemRepository.findByReviewSpaceId,
      ).mockResolvedValue(testCheckListItems);

      const command: ExecuteReviewCommand = {
        reviewSpaceId: testReviewSpaceId,
        name: "テストレビュー",
        userId: testUserId,
        employeeId: testEmployeeId,
        files: testFiles,
        fileBuffers: createTestFileBuffers(),
      };

      await service.execute(command);

      // ペイロードのチェックリスト項目を確認
      const enqueueCall = mockEnqueueTask.mock.calls[0][0];
      expect(enqueueCall.payload.checkListItems).toHaveLength(2);
      expect(enqueueCall.payload.checkListItems[0]).toMatchObject({
        id: testCheckListItemId1,
        content: "チェック項目1",
      });
      expect(enqueueCall.payload.checkListItems[1]).toMatchObject({
        id: testCheckListItemId2,
        content: "チェック項目2",
      });
    });
  });
});
