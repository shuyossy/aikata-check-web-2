import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  GenerateCheckListByAIService,
  type GenerateCheckListByAICommand,
} from "../GenerateCheckListByAIService";
import type { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import type { IProjectRepository, ISystemSettingRepository } from "@/application/shared/port/repository";
import { AiTaskQueueService } from "@/application/aiTask/AiTaskQueueService";
import { ReviewSpace } from "@/domain/reviewSpace";
import { Project } from "@/domain/project";
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

describe("GenerateCheckListByAIService", () => {
  // モックリポジトリ
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

  let service: GenerateCheckListByAIService;

  // テスト用データ（有効なUUID v4形式）
  const testProjectId = "550e8400-e29b-41d4-a716-446655440001";
  const testReviewSpaceId = "550e8400-e29b-41d4-a716-446655440002";
  const testUserId = "550e8400-e29b-41d4-a716-446655440003";
  const testTaskId = "550e8400-e29b-41d4-a716-446655440004";
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

    service = new GenerateCheckListByAIService(
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

      const command: GenerateCheckListByAICommand = {
        reviewSpaceId: testReviewSpaceId,
        userId: testUserId,
        files: testFiles,
        fileBuffers: createTestFileBuffers(),
        checklistRequirements: "システム設計のチェックポイント",
      };

      const result = await service.execute(command);

      expect(result.status).toBe("queued");
      expect(result.reviewSpaceId).toBe(testReviewSpaceId);
      expect(result.queueLength).toBe(1);

      // キューにタスクが登録される
      expect(mockEnqueueTask).toHaveBeenCalledTimes(1);
      expect(mockEnqueueTask).toHaveBeenCalledWith(
        expect.objectContaining({
          taskType: AI_TASK_TYPE.CHECKLIST_GENERATION,
          apiKey: "test-api-key",
        }),
      );
    });

    it("画像モードのファイルも処理できる", async () => {
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);

      const filesWithImage: RawUploadFileMeta[] = [
        {
          id: "file-1",
          name: "document.pdf",
          type: "application/pdf",
          size: 5000,
          processMode: "image",
          convertedImageCount: 1,
        },
      ];

      const imageFileBuffers: FileBuffersMap = new Map();
      imageFileBuffers.set("file-1", {
        buffer: Buffer.from("元PDFデータ"),
        convertedImageBuffers: [Buffer.from("PNG画像データ")],
      });

      const command: GenerateCheckListByAICommand = {
        reviewSpaceId: testReviewSpaceId,
        userId: testUserId,
        files: filesWithImage,
        fileBuffers: imageFileBuffers,
        checklistRequirements: "ドキュメントからチェックリストを生成",
      };

      const result = await service.execute(command);

      expect(result.status).toBe("queued");
      expect(mockEnqueueTask).toHaveBeenCalledTimes(1);
    });
  });

  describe("異常系 - 入力バリデーション", () => {
    it("ファイルが空の場合エラーになる", async () => {
      const command: GenerateCheckListByAICommand = {
        reviewSpaceId: testReviewSpaceId,
        userId: testUserId,
        files: [],
        fileBuffers: new Map(),
        checklistRequirements: "テスト要件",
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "AI_CHECKLIST_GENERATION_NO_FILES",
      });
    });

    it("チェックリスト生成要件が空の場合エラーになる", async () => {
      const command: GenerateCheckListByAICommand = {
        reviewSpaceId: testReviewSpaceId,
        userId: testUserId,
        files: testFiles,
        fileBuffers: createTestFileBuffers(),
        checklistRequirements: "",
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "AI_CHECKLIST_GENERATION_REQUIREMENTS_EMPTY",
      });
    });

    it("チェックリスト生成要件が空白のみの場合もエラーになる", async () => {
      const command: GenerateCheckListByAICommand = {
        reviewSpaceId: testReviewSpaceId,
        userId: testUserId,
        files: testFiles,
        fileBuffers: createTestFileBuffers(),
        checklistRequirements: "   ",
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "AI_CHECKLIST_GENERATION_REQUIREMENTS_EMPTY",
      });
    });
  });

  describe("異常系 - 権限確認", () => {
    it("レビュースペースが存在しない場合エラーになる", async () => {
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(null);

      const command: GenerateCheckListByAICommand = {
        reviewSpaceId: testReviewSpaceId,
        userId: testUserId,
        files: testFiles,
        fileBuffers: createTestFileBuffers(),
        checklistRequirements: "テスト要件",
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

      const command: GenerateCheckListByAICommand = {
        reviewSpaceId: testReviewSpaceId,
        userId: testUserId,
        files: testFiles,
        fileBuffers: createTestFileBuffers(),
        checklistRequirements: "テスト要件",
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
      const command: GenerateCheckListByAICommand = {
        reviewSpaceId: testReviewSpaceId,
        userId: nonMemberUserId,
        files: testFiles,
        fileBuffers: createTestFileBuffers(),
        checklistRequirements: "テスト要件",
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "PROJECT_ACCESS_DENIED",
      });
    });
  });

  describe("キュー登録", () => {
    it("ペイロードにチェックリスト生成要件が含まれる", async () => {
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);

      const command: GenerateCheckListByAICommand = {
        reviewSpaceId: testReviewSpaceId,
        userId: testUserId,
        files: testFiles,
        fileBuffers: createTestFileBuffers(),
        checklistRequirements: "セキュリティに関するチェックポイント",
      };

      await service.execute(command);

      // ペイロードのチェックリスト生成要件を確認
      const enqueueCall = mockEnqueueTask.mock.calls[0][0];
      expect(enqueueCall.payload.checklistRequirements).toBe(
        "セキュリティに関するチェックポイント",
      );
      expect(enqueueCall.payload.reviewSpaceId).toBe(testReviewSpaceId);
      expect(enqueueCall.payload.userId).toBe(testUserId);
    });

    it("ファイルバッファがFileInfoCommand配列に変換される", async () => {
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);

      const command: GenerateCheckListByAICommand = {
        reviewSpaceId: testReviewSpaceId,
        userId: testUserId,
        files: testFiles,
        fileBuffers: createTestFileBuffers(),
        checklistRequirements: "テスト要件",
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
  });
});
