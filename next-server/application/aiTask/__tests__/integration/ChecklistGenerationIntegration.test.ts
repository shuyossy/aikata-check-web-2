/**
 * AIチェックリスト生成 結合テスト
 *
 * GenerateCheckListByAIService → AiTaskQueueService → AiTaskExecutor → checklistGenerationWorkflow → DB保存
 * の一連の流れをテストする
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RuntimeContext } from "@mastra/core/di";
import type {
  IProjectRepository,
  ISystemSettingRepository,
} from "@/application/shared/port/repository";
import type { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import type { ICheckListItemRepository } from "@/application/shared/port/repository/ICheckListItemRepository";
import type { IReviewTargetRepository } from "@/application/shared/port/repository/IReviewTargetRepository";
import type { IReviewResultRepository } from "@/application/shared/port/repository/IReviewResultRepository";
import type { IReviewDocumentCacheRepository } from "@/application/shared/port/repository/IReviewDocumentCacheRepository";
import type { ILargeDocumentResultCacheRepository } from "@/application/shared/port/repository/ILargeDocumentResultCacheRepository";
import type { IAiTaskRepository } from "@/application/shared/port/repository/IAiTaskRepository";
import type { IAiTaskFileMetadataRepository } from "@/application/shared/port/repository/IAiTaskFileMetadataRepository";
import {
  GenerateCheckListByAIService,
  type GenerateCheckListByAICommand,
} from "@/application/checkListItem/GenerateCheckListByAIService";
import { AiTaskQueueService } from "@/application/aiTask/AiTaskQueueService";
import {
  AiTaskExecutor,
  type ChecklistGenerationTaskPayload,
} from "@/application/aiTask/AiTaskExecutor";
import type { AiTaskDto, AiTask } from "@/domain/aiTask";
import { ReviewSpace } from "@/domain/reviewSpace";
import { Project, ProjectId } from "@/domain/project";
import { CheckListItem } from "@/domain/checkListItem";
import type { RawUploadFileMeta, FileBuffersMap } from "@/application/mastra";
import { FILE_BUFFERS_CONTEXT_KEY } from "@/application/mastra";

// ========================================
// vi.hoistedでモック関数をホイスト
// ========================================
const {
  mockStartWorkersForApiKeyHash,
  mockTopicExtractionAgentGenerateLegacy,
  mockTopicChecklistAgentGenerateLegacy,
  mockChecklistRefinementAgentGenerateLegacy,
  mockFileProcessingStep,
} = vi.hoisted(() => ({
  mockStartWorkersForApiKeyHash: vi.fn(),
  mockTopicExtractionAgentGenerateLegacy: vi.fn(),
  mockTopicChecklistAgentGenerateLegacy: vi.fn(),
  mockChecklistRefinementAgentGenerateLegacy: vi.fn(),
  mockFileProcessingStep: vi.fn(),
}));

// ========================================
// ロガーのモック（最初に定義）
// ========================================
vi.mock("@/lib/server/logger", () => ({
  getLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
  getLogLevel: vi.fn().mockReturnValue("info"),
  createContextLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ========================================
// TaskFileHelperのモック
// ========================================
vi.mock("@/lib/server/taskFileHelper", () => ({
  TaskFileHelper: {
    ensureBaseDir: vi.fn().mockResolvedValue(undefined),
    saveFile: vi.fn().mockResolvedValue("/mock/path/file.txt"),
    saveConvertedImages: vi.fn().mockResolvedValue(undefined),
    loadFile: vi.fn().mockResolvedValue(Buffer.from("test content")),
    loadConvertedImages: vi.fn().mockResolvedValue([Buffer.from("image1")]),
    deleteTaskFiles: vi.fn().mockResolvedValue(undefined),
    getConvertedImagePath: vi.fn().mockReturnValue("/mock/image/path"),
  },
}));

// ========================================
// AIエージェントのモック（AI API呼び出しのみモック）
// ========================================
vi.mock("@/application/mastra/agents", () => ({
  topicExtractionAgent: {
    generateLegacy: (...args: unknown[]) =>
      mockTopicExtractionAgentGenerateLegacy(...args),
  },
  topicExtractionOutputSchema: {
    parse: vi.fn((v: unknown) => v),
  },
  topicChecklistAgent: {
    generateLegacy: (...args: unknown[]) =>
      mockTopicChecklistAgentGenerateLegacy(...args),
  },
  topicChecklistOutputSchema: {
    parse: vi.fn((v: unknown) => v),
  },
  checklistRefinementAgent: {
    generateLegacy: (...args: unknown[]) =>
      mockChecklistRefinementAgentGenerateLegacy(...args),
  },
  checklistRefinementOutputSchema: {
    parse: vi.fn((v: unknown) => v),
  },
  // レビュー関連のエージェント（結合テストでは使用しないがインポート互換性のため）
  reviewExecuteAgent: {},
  reviewResultItemSchema: {},
  reviewExecuteOutputSchema: {},
  checklistCategoryAgent: {},
  checklistCategoryOutputSchema: {},
  individualDocumentReviewAgent: {},
  individualDocumentReviewResultItemSchema: {},
  individualDocumentReviewOutputSchema: {},
  consolidateReviewAgent: {},
  consolidateReviewResultItemSchema: {},
  consolidateReviewOutputSchema: {},
  qaPlanningAgent: {},
  qaResearchAgent: {},
  qaAnswerAgent: {},
}));

// ========================================
// fileProcessingStepのモック（ファイル処理のみモック）
// ワークフロー制御フローは実際に実行する
// ========================================
vi.mock("@/application/mastra/workflows/shared", async () => {
  const actual = await vi.importActual<
    typeof import("@/application/mastra/workflows/shared")
  >("@/application/mastra/workflows/shared");
  return {
    ...actual,
    fileProcessingStep: {
      id: "file-processing",
      description: "ファイルからテキスト抽出/画像変換を行う",
      inputSchema: actual.fileProcessingInputSchema,
      outputSchema: actual.fileProcessingOutputSchema,
      execute: mockFileProcessingStep,
    },
  };
});

// ========================================
// mastraモジュールのモック（実際のワークフローを使用）
// Mastraインスタンス作成をスキップしつつ、ワークフローは実際に実行
// ========================================
vi.mock("@/application/mastra", async () => {
  // 実際のワークフローとユーティリティをインポート
  const workflowUtils = await vi.importActual<
    typeof import("@/application/mastra/lib/workflowUtils")
  >("@/application/mastra/lib/workflowUtils");
  const checklistGenerationWorkflowModule = await vi.importActual<
    typeof import("@/application/mastra/workflows/checklistGeneration")
  >("@/application/mastra/workflows/checklistGeneration");

  return {
    // mastraオブジェクトのモック：実際のワークフローを返す
    mastra: {
      getWorkflow: vi.fn().mockImplementation((name: string) => {
        if (name === "checklistGenerationWorkflow") {
          return checklistGenerationWorkflowModule.checklistGenerationWorkflow;
        }
        return undefined;
      }),
    },
    // 実際のユーティリティ関数を使用
    checkWorkflowResult: workflowUtils.checkWorkflowResult,
    checkStatuses: workflowUtils.checkStatuses,
    // ワークフローとスキーマのエクスポート
    checklistGenerationWorkflow:
      checklistGenerationWorkflowModule.checklistGenerationWorkflow,
    rawUploadFileMetaSchema:
      checklistGenerationWorkflowModule.rawUploadFileMetaSchema,
    extractedFileSchema: checklistGenerationWorkflowModule.extractedFileSchema,
    FILE_BUFFERS_CONTEXT_KEY:
      checklistGenerationWorkflowModule.FILE_BUFFERS_CONTEXT_KEY,
  };
});

// ========================================
// AiTaskBootstrapのモック
// ========================================
vi.mock("@/application/aiTask", async () => {
  const actual = await vi.importActual<typeof import("@/application/aiTask")>(
    "@/application/aiTask",
  );
  return {
    ...actual,
    getAiTaskBootstrap: vi.fn().mockReturnValue({
      startWorkersForApiKeyHash: mockStartWorkersForApiKeyHash,
    }),
  };
});

// ========================================
// テストヘルパー関数
// ========================================

/**
 * テスト用ファイルメタデータを作成
 */
const createTestFileMeta = (
  processMode: "text" | "image" = "text",
  index: number = 0,
): RawUploadFileMeta => ({
  id: `file-${index}`,
  name: processMode === "text" ? `test-${index}.txt` : `test-${index}.pdf`,
  type: processMode === "text" ? "text/plain" : "application/pdf",
  size: 1000,
  processMode,
  ...(processMode === "image" && { convertedImageCount: 2 }),
});

/**
 * テスト用FileBuffersMapを作成
 */
const createTestFileBuffers = (files: RawUploadFileMeta[]): FileBuffersMap => {
  const map = new Map();
  for (const file of files) {
    if (file.processMode === "image") {
      map.set(file.id, {
        buffer: Buffer.alloc(0),
        convertedImageBuffers: [
          Buffer.from("base64image1"),
          Buffer.from("base64image2"),
        ],
      });
    } else {
      map.set(file.id, {
        buffer: Buffer.from("テストドキュメントの内容"),
      });
    }
  }
  return map;
};

/**
 * RuntimeContext検証用ヘルパー
 */
interface RuntimeContextExpectations {
  shouldExist?: string[];
  shouldNotExist?: string[];
  exactValues?: Record<string, unknown>;
  shouldBeMap?: string[];
  /** Mapの要素数を検証 */
  mapSize?: Record<string, number>;
  /** Mapが特定のキーを持つか検証 */
  mapHasKeys?: Record<string, string[]>;
}

const assertRuntimeContext = (
  runtimeContext: { get: (key: string) => unknown } | null,
  expectations: RuntimeContextExpectations,
): void => {
  expect(runtimeContext).not.toBeNull();

  if (expectations.shouldExist) {
    for (const key of expectations.shouldExist) {
      expect(runtimeContext!.get(key)).toBeDefined();
    }
  }

  if (expectations.shouldNotExist) {
    for (const key of expectations.shouldNotExist) {
      expect(runtimeContext!.get(key)).toBeUndefined();
    }
  }

  if (expectations.exactValues) {
    for (const [key, value] of Object.entries(expectations.exactValues)) {
      expect(runtimeContext!.get(key)).toEqual(value);
    }
  }

  if (expectations.shouldBeMap) {
    for (const key of expectations.shouldBeMap) {
      expect(runtimeContext!.get(key)).toBeInstanceOf(Map);
    }
  }

  if (expectations.mapSize) {
    for (const [key, expectedSize] of Object.entries(expectations.mapSize)) {
      const map = runtimeContext!.get(key) as Map<unknown, unknown>;
      expect(map).toBeInstanceOf(Map);
      expect(map.size).toBe(expectedSize);
    }
  }

  if (expectations.mapHasKeys) {
    for (const [contextKey, expectedMapKeys] of Object.entries(
      expectations.mapHasKeys,
    )) {
      const map = runtimeContext!.get(contextKey) as Map<string, unknown>;
      expect(map).toBeInstanceOf(Map);
      for (const mapKey of expectedMapKeys) {
        expect(map.has(mapKey)).toBe(true);
      }
    }
  }
};

/**
 * キュー登録時のペイロード検証用ヘルパー
 */
interface ExpectedTaskPayload {
  taskType: string;
  reviewSpaceId: string;
  userId: string;
  files: RawUploadFileMeta[];
  checklistRequirements: string;
  aiApiConfig: { apiKey: string; apiUrl: string; apiModel: string };
}

const assertSavedTaskPayload = (
  mockSave: ReturnType<typeof vi.fn>,
  expected: ExpectedTaskPayload,
): void => {
  expect(mockSave).toHaveBeenCalledTimes(1);
  const savedTask = vi.mocked(mockSave).mock.calls[0][0] as AiTask;

  // タスクタイプ検証
  expect(savedTask.taskType.value).toBe(expected.taskType);

  // ペイロード検証
  const payload =
    savedTask.payload as unknown as ChecklistGenerationTaskPayload;
  expect(payload.reviewSpaceId).toBe(expected.reviewSpaceId);
  expect(payload.userId).toBe(expected.userId);
  expect(payload.checklistRequirements).toBe(expected.checklistRequirements);
  expect(payload.aiApiConfig).toEqual(expected.aiApiConfig);

  // ファイル配列検証
  expect(payload.files).toHaveLength(expected.files.length);
  payload.files.forEach((file, index) => {
    const expectedFile = expected.files[index];
    expect(file.id).toBe(expectedFile.id);
    expect(file.name).toBe(expectedFile.name);
    expect(file.type).toBe(expectedFile.type);
    expect(file.size).toBe(expectedFile.size);
    expect(file.processMode).toBe(expectedFile.processMode);
  });
};

/**
 * ReviewSpaceのchecklistGenerationError更新検証用ヘルパー
 * @param mockUpdate updateChecklistGenerationErrorのモック
 * @param expectedReviewSpaceId 期待されるレビュースペースID
 * @param expectedError 期待されるエラーメッセージ（nullの場合はエラークリア、文字列の場合は部分一致で検証）
 */
const assertUpdateChecklistGenerationError = (
  mockUpdate: ReturnType<typeof vi.fn>,
  expectedReviewSpaceId: string,
  expectedError: string | null,
): void => {
  expect(mockUpdate).toHaveBeenCalledTimes(1);
  const [reviewSpaceId, error] = vi.mocked(mockUpdate).mock.calls[0] as [
    { value: string },
    string | null,
  ];
  expect(reviewSpaceId.value).toBe(expectedReviewSpaceId);
  if (expectedError === null) {
    expect(error).toBeNull();
  } else {
    expect(typeof error).toBe("string");
  }
};

// ========================================
// テスト本体
// ========================================
describe("AIチェックリスト生成 結合テスト", () => {
  // テスト用ID（UUID形式）
  const testUserId = "550e8400-e29b-41d4-a716-446655440000";
  const testProjectId = "550e8400-e29b-41d4-a716-446655440001";
  const testReviewSpaceId = "550e8400-e29b-41d4-a716-446655440002";
  const testTaskId = "550e8400-e29b-41d4-a716-446655440003";

  const now = new Date();

  // テスト用エンティティ
  const testProject = Project.reconstruct({
    id: testProjectId,
    name: "テストプロジェクト",
    description: null,
    members: [{ userId: testUserId, createdAt: now }],
    encryptedApiKey: null,
    createdAt: now,
    updatedAt: now,
  });

  const testReviewSpace = ReviewSpace.reconstruct({
    id: testReviewSpaceId,
    projectId: testProjectId,
    name: "テストレビュースペース",
    description: null,
    checklistGenerationError: null,
    createdAt: now,
    updatedAt: now,
  });

  // モックリポジトリ
  const mockReviewSpaceRepository: IReviewSpaceRepository = {
    findById: vi.fn(),
    findByProjectId: vi.fn(),
    countByProjectId: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    updateChecklistGenerationError: vi.fn(),
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

  const mockAiTaskFileMetadataRepository: IAiTaskFileMetadataRepository = {
    findById: vi.fn(),
    findByTaskId: vi.fn(),
    save: vi.fn(),
    saveMany: vi.fn(),
    delete: vi.fn(),
    deleteByTaskId: vi.fn(),
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

  const mockReviewDocumentCacheRepository: IReviewDocumentCacheRepository = {
    findById: vi.fn(),
    findByReviewTargetId: vi.fn(),
    save: vi.fn(),
    saveMany: vi.fn(),
    deleteByReviewTargetId: vi.fn(),
  };

  const mockLargeDocumentResultCacheRepository: ILargeDocumentResultCacheRepository =
    {
      save: vi.fn(),
      saveMany: vi.fn(),
      findByReviewTargetId: vi.fn(),
      deleteByReviewTargetId: vi.fn(),
      findChecklistResultsWithIndividualResults: vi.fn(),
      getMaxTotalChunksForDocument: vi.fn(),
    };

  // サービスとエグゼキューター
  let queueService: AiTaskQueueService;
  let service: GenerateCheckListByAIService;
  let executor: AiTaskExecutor;

  /**
   * テスト用のチェックリスト生成タスクDtoを作成
   */
  const createTestChecklistTaskDto = (
    files: RawUploadFileMeta[],
    checklistRequirements: string,
  ): AiTaskDto => ({
    id: testTaskId,
    taskType: "checklist_generation",
    status: "processing",
    apiKeyHash: "test-api-key-hash",
    priority: 5,
    payload: {
      reviewSpaceId: testReviewSpaceId,
      userId: testUserId,
      files,
      checklistRequirements,
      aiApiConfig: {
        apiKey: "test-api-key",
        apiUrl: "http://test-api-url",
        apiModel: "test-model",
      },
    } as Record<string, unknown>,
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
    startedAt: now,
    completedAt: null,
    fileMetadata: files.map((f, i) => ({
      id: `file-meta-${i}`,
      taskId: testTaskId,
      fileName: f.name,
      filePath: `/path/to/${f.name}`,
      fileSize: f.size,
      mimeType: f.type,
      processMode: f.processMode ?? ("text" as const),
      convertedImageCount: f.convertedImageCount ?? 0,
      createdAt: now,
    })),
  });

  // 環境変数のバックアップ用
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.clearAllMocks();

    // 環境変数のバックアップと設定
    originalEnv = { ...process.env };
    process.env.AI_API_KEY = "test-api-key";
    process.env.AI_API_URL = "http://test-api-url";
    process.env.AI_API_MODEL = "test-model";

    // リポジトリのデフォルト戻り値設定
    vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
      testReviewSpace,
    );
    vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
    // システム設定はnullを返す（環境変数で代替）
    vi.mocked(mockSystemSettingRepository.find).mockResolvedValue(null);
    vi.mocked(mockAiTaskRepository.save).mockResolvedValue(undefined);
    vi.mocked(mockAiTaskRepository.countQueuedByApiKeyHash).mockResolvedValue(
      1,
    );
    vi.mocked(mockCheckListItemRepository.bulkInsert).mockResolvedValue(
      undefined,
    );
    vi.mocked(
      mockReviewSpaceRepository.updateChecklistGenerationError,
    ).mockResolvedValue(undefined);

    // ワーカー起動モック
    mockStartWorkersForApiKeyHash.mockResolvedValue(undefined);

    // fileProcessingStepのデフォルトモック設定
    mockFileProcessingStep.mockResolvedValue({
      status: "success",
      extractedFiles: [
        {
          id: "file-0",
          name: "test-0.txt",
          type: "text/plain",
          processMode: "text",
          textContent: "テストドキュメントの内容",
        },
      ],
    });

    // AIエージェントのデフォルトモック設定
    mockTopicExtractionAgentGenerateLegacy.mockResolvedValue({
      object: {
        topics: [{ title: "デフォルトトピック", reason: "デフォルト理由" }],
      },
    });

    mockTopicChecklistAgentGenerateLegacy.mockResolvedValue({
      object: {
        checklistItems: ["デフォルトチェック項目"],
      },
    });

    mockChecklistRefinementAgentGenerateLegacy.mockResolvedValue({
      object: {
        refinedChecklists: ["デフォルトチェック項目"],
      },
    });

    // サービスとエグゼキューターの初期化
    queueService = new AiTaskQueueService(
      mockAiTaskRepository,
      mockAiTaskFileMetadataRepository,
    );

    service = new GenerateCheckListByAIService(
      mockReviewSpaceRepository,
      mockProjectRepository,
      mockSystemSettingRepository,
      queueService,
    );

    executor = new AiTaskExecutor(
      mockReviewTargetRepository,
      mockReviewResultRepository,
      mockCheckListItemRepository,
      mockReviewDocumentCacheRepository,
      mockReviewSpaceRepository,
      mockLargeDocumentResultCacheRepository,
    );
  });

  afterEach(() => {
    // 環境変数を復元
    process.env = originalEnv;
    // vi.resetAllMocks()はモック実装もリセットしてしまうため使用しない
    // vi.clearAllMocks()でモック呼び出し履歴のみクリア
  });

  describe("正常系", () => {
    describe("テキストモードファイルでの一連の流れ", () => {
      it("サービス→キュー登録→エグゼキューター実行→DB保存が正常に動作すること", async () => {
        // Arrange
        const testFiles: RawUploadFileMeta[] = [createTestFileMeta("text", 0)];
        const testFileBuffers = createTestFileBuffers(testFiles);
        const checklistRequirements =
          "セキュリティに関するチェックリストを作成";

        // fileProcessingStepのモック設定
        mockFileProcessingStep.mockResolvedValue({
          status: "success",
          extractedFiles: [
            {
              id: "file-0",
              name: "test-0.txt",
              type: "text/plain",
              processMode: "text",
              textContent: "テストドキュメントの内容",
            },
          ],
        });

        // エージェントモックの設定
        mockTopicExtractionAgentGenerateLegacy.mockResolvedValue({
          object: {
            topics: [
              { title: "セキュリティ対策", reason: "セキュリティは重要" },
              { title: "データ保護", reason: "データ保護は必須" },
            ],
          },
        });

        mockTopicChecklistAgentGenerateLegacy
          .mockResolvedValueOnce({
            object: { checklistItems: ["セキュリティ項目1"] },
          })
          .mockResolvedValueOnce({
            object: { checklistItems: ["データ保護項目1"] },
          });

        mockChecklistRefinementAgentGenerateLegacy.mockResolvedValue({
          object: {
            refinedChecklists: [
              "精査済みチェック項目1",
              "精査済みチェック項目2",
            ],
          },
        });

        // Act 1: サービス経由でキュー登録
        const command: GenerateCheckListByAICommand = {
          reviewSpaceId: testReviewSpaceId,
          userId: testUserId,
          files: testFiles,
          fileBuffers: testFileBuffers,
          checklistRequirements,
        };

        const enqueueResult = await service.execute(command);

        // Assert 1: キュー登録の検証
        expect(enqueueResult.status).toBe("queued");
        expect(enqueueResult.reviewSpaceId).toBe(testReviewSpaceId);
        expect(mockStartWorkersForApiKeyHash).toHaveBeenCalled();

        // キュー登録ペイロードの詳細検証
        assertSavedTaskPayload(mockAiTaskRepository.save, {
          taskType: "checklist_generation",
          reviewSpaceId: testReviewSpaceId,
          userId: testUserId,
          files: testFiles,
          checklistRequirements,
          aiApiConfig: {
            apiKey: "test-api-key",
            apiUrl: "http://test-api-url",
            apiModel: "test-model",
          },
        });

        // Act 2: エグゼキューターでタスク実行（実際のワークフローを実行）
        const taskDto = createTestChecklistTaskDto(
          testFiles,
          checklistRequirements,
        );
        const executorResult = await executor.execute(taskDto);

        // Assert 2: 実行結果の検証
        expect(executorResult.success).toBe(true);
        expect(mockCheckListItemRepository.bulkInsert).toHaveBeenCalled();

        // ワークフローの各ステップが実行されたことを確認
        expect(mockFileProcessingStep).toHaveBeenCalled();
        expect(mockTopicExtractionAgentGenerateLegacy).toHaveBeenCalledTimes(1);
        expect(mockTopicChecklistAgentGenerateLegacy).toHaveBeenCalledTimes(2); // 2トピック分
        expect(
          mockChecklistRefinementAgentGenerateLegacy,
        ).toHaveBeenCalledTimes(1);

        // bulkInsertに渡された引数を検証
        const bulkInsertCall = vi.mocked(mockCheckListItemRepository.bulkInsert)
          .mock.calls[0];
        const savedItems = bulkInsertCall[0] as CheckListItem[];
        expect(savedItems.length).toBe(2);
        expect(savedItems[0].content.value).toBe("精査済みチェック項目1");
        expect(savedItems[1].content.value).toBe("精査済みチェック項目2");

        // エラーがクリアされたことを確認（ReviewSpaceIdも検証）
        assertUpdateChecklistGenerationError(
          mockReviewSpaceRepository.updateChecklistGenerationError,
          testReviewSpaceId,
          null,
        );
      });

      it("RuntimeContextが正しく設定されること", async () => {
        // Arrange
        const testFiles: RawUploadFileMeta[] = [createTestFileMeta("text", 0)];
        const checklistRequirements = "テスト用チェックリスト";

        // エージェント呼び出し時にRuntimeContextをキャプチャ
        let capturedRuntimeContext: RuntimeContext | null = null;
        mockTopicExtractionAgentGenerateLegacy.mockImplementation(
          async (_message, options) => {
            capturedRuntimeContext = options.runtimeContext;
            return {
              object: {
                topics: [{ title: "テストトピック", reason: "テスト理由" }],
              },
            };
          },
        );

        mockTopicChecklistAgentGenerateLegacy.mockResolvedValue({
          object: { checklistItems: ["チェック項目1"] },
        });

        mockChecklistRefinementAgentGenerateLegacy.mockResolvedValue({
          object: { refinedChecklists: ["チェック項目1"] },
        });

        // Act
        const taskDto = createTestChecklistTaskDto(
          testFiles,
          checklistRequirements,
        );
        await executor.execute(taskDto);

        // Assert: RuntimeContextが正しく含まれていることを確認
        assertRuntimeContext(capturedRuntimeContext, {
          shouldExist: [
            "employeeId",
            "aiApiKey",
            "aiApiUrl",
            "aiApiModel",
            "checklistRequirements",
          ],
          exactValues: {
            employeeId: testUserId,
            aiApiKey: "test-api-key",
            aiApiUrl: "http://test-api-url",
            aiApiModel: "test-model",
            checklistRequirements,
          },
        });
      });

      it("RuntimeContextにファイルバッファが正しく設定されること", async () => {
        // Arrange
        const testFiles: RawUploadFileMeta[] = [
          createTestFileMeta("text", 0),
          createTestFileMeta("image", 1),
        ];
        const checklistRequirements = "ファイルバッファ検証テスト";

        // fileProcessingStepでRuntimeContextをキャプチャ
        let capturedFileBuffers: FileBuffersMap | null = null;
        mockFileProcessingStep.mockImplementation(
          async ({ runtimeContext }) => {
            if (runtimeContext) {
              capturedFileBuffers = runtimeContext.get(
                FILE_BUFFERS_CONTEXT_KEY,
              ) as FileBuffersMap;
            }
            return {
              status: "success",
              extractedFiles: [
                {
                  id: "file-0",
                  name: "test-0.txt",
                  type: "text/plain",
                  processMode: "text",
                  textContent: "テストドキュメント",
                },
                {
                  id: "file-1",
                  name: "test-1.pdf",
                  type: "application/pdf",
                  processMode: "image",
                  imageData: ["base64image1", "base64image2"],
                },
              ],
            };
          },
        );

        mockTopicExtractionAgentGenerateLegacy.mockResolvedValue({
          object: { topics: [{ title: "テストトピック", reason: "理由" }] },
        });

        mockTopicChecklistAgentGenerateLegacy.mockResolvedValue({
          object: { checklistItems: ["チェック項目"] },
        });

        mockChecklistRefinementAgentGenerateLegacy.mockResolvedValue({
          object: { refinedChecklists: ["チェック項目"] },
        });

        // Act
        const taskDto = createTestChecklistTaskDto(
          testFiles,
          checklistRequirements,
        );
        await executor.execute(taskDto);

        // Assert: ファイルバッファがRuntimeContextに正しく設定されていること
        expect(capturedFileBuffers).not.toBeNull();
        expect(capturedFileBuffers).toBeInstanceOf(Map);
        expect(capturedFileBuffers!.size).toBe(2);

        // テキストファイルのバッファ検証
        expect(capturedFileBuffers!.has("file-0")).toBe(true);
        const textBuffer = capturedFileBuffers!.get("file-0");
        expect(textBuffer).toBeDefined();
        expect(textBuffer!.buffer).toBeInstanceOf(Buffer);

        // 画像ファイルのバッファ検証
        expect(capturedFileBuffers!.has("file-1")).toBe(true);
        const imageBuffer = capturedFileBuffers!.get("file-1");
        expect(imageBuffer).toBeDefined();
        expect(imageBuffer!.convertedImageBuffers).toBeDefined();
        expect(imageBuffer!.convertedImageBuffers!.length).toBeGreaterThan(0);
      });
    });

    describe("画像モードファイル（PDF変換済み）での処理", () => {
      it("変換済み画像がBase64として正しく処理されること", async () => {
        // Arrange
        const testFiles: RawUploadFileMeta[] = [createTestFileMeta("image", 0)];
        const checklistRequirements = "PDFチェックリスト";

        // fileProcessingStepが画像ファイルを処理した結果をモック
        mockFileProcessingStep.mockResolvedValue({
          status: "success",
          extractedFiles: [
            {
              id: "file-0",
              name: "test-0.pdf",
              type: "application/pdf",
              processMode: "image",
              imageData: ["base64encodedimage1", "base64encodedimage2"],
            },
          ],
        });

        mockTopicExtractionAgentGenerateLegacy.mockResolvedValue({
          object: {
            topics: [{ title: "画像トピック", reason: "画像から抽出" }],
          },
        });

        mockTopicChecklistAgentGenerateLegacy.mockResolvedValue({
          object: { checklistItems: ["PDF精査項目1"] },
        });

        mockChecklistRefinementAgentGenerateLegacy.mockResolvedValue({
          object: { refinedChecklists: ["PDF精査項目1"] },
        });

        // Act
        const taskDto = createTestChecklistTaskDto(
          testFiles,
          checklistRequirements,
        );
        const result = await executor.execute(taskDto);

        // Assert
        expect(result.success).toBe(true);
        expect(mockCheckListItemRepository.bulkInsert).toHaveBeenCalled();

        // エージェントに画像が渡されていることを確認
        const topicExtractionCallArgs =
          mockTopicExtractionAgentGenerateLegacy.mock.calls[0];
        const message = topicExtractionCallArgs[0];
        expect(message.content).toEqual(
          expect.arrayContaining([expect.objectContaining({ type: "image" })]),
        );
      });
    });

    describe("複数ファイル混合処理", () => {
      it("テキストと画像の混合ファイルが正しく処理されること", async () => {
        // Arrange
        const testFiles: RawUploadFileMeta[] = [
          createTestFileMeta("text", 0),
          createTestFileMeta("image", 1),
        ];
        const checklistRequirements = "複合ドキュメントチェックリスト";

        // fileProcessingStepが混合ファイルを処理した結果をモック
        mockFileProcessingStep.mockResolvedValue({
          status: "success",
          extractedFiles: [
            {
              id: "file-0",
              name: "test-0.txt",
              type: "text/plain",
              processMode: "text",
              textContent: "テキストファイルの内容",
            },
            {
              id: "file-1",
              name: "test-1.pdf",
              type: "application/pdf",
              processMode: "image",
              imageData: ["base64encodedimage"],
            },
          ],
        });

        mockTopicExtractionAgentGenerateLegacy.mockResolvedValue({
          object: {
            topics: [
              { title: "統合トピック1", reason: "理由1" },
              { title: "統合トピック2", reason: "理由2" },
            ],
          },
        });

        mockTopicChecklistAgentGenerateLegacy
          .mockResolvedValueOnce({ object: { checklistItems: ["統合項目1"] } })
          .mockResolvedValueOnce({ object: { checklistItems: ["統合項目2"] } });

        mockChecklistRefinementAgentGenerateLegacy.mockResolvedValue({
          object: { refinedChecklists: ["統合項目1", "統合項目2"] },
        });

        // Act
        const taskDto = createTestChecklistTaskDto(
          testFiles,
          checklistRequirements,
        );
        const result = await executor.execute(taskDto);

        // Assert
        expect(result.success).toBe(true);
        expect(mockCheckListItemRepository.bulkInsert).toHaveBeenCalled();

        // メッセージにテキストと画像の両方が含まれることを確認
        const topicExtractionCallArgs =
          mockTopicExtractionAgentGenerateLegacy.mock.calls[0];
        const message = topicExtractionCallArgs[0];
        expect(message.content).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ type: "text" }),
            expect.objectContaining({ type: "image" }),
          ]),
        );
      });
    });
  });

  describe("異常系", () => {
    describe("ワークフロー失敗時のエラーハンドリング", () => {
      it("トピック抽出失敗時にエラーがReviewSpace.checklistGenerationErrorに保存されること", async () => {
        // Arrange
        const testFiles: RawUploadFileMeta[] = [createTestFileMeta("text", 0)];
        const checklistRequirements = "失敗テスト";

        // トピック抽出エージェントが失敗するようにモック
        mockTopicExtractionAgentGenerateLegacy.mockRejectedValue(
          new Error("API呼び出しエラー"),
        );

        // Act
        const taskDto = createTestChecklistTaskDto(
          testFiles,
          checklistRequirements,
        );
        const result = await executor.execute(taskDto);

        // Assert
        expect(result.success).toBe(false);
        expect(result.errorMessage).toBeDefined();
        // ReviewSpaceIdを検証（エラーメッセージは正規化されて「予期せぬエラー」になる可能性がある）
        expect(
          mockReviewSpaceRepository.updateChecklistGenerationError,
        ).toHaveBeenCalledTimes(1);
        const [reviewSpaceId, errorMessage] =
          mockReviewSpaceRepository.updateChecklistGenerationError.mock
            .calls[0];
        expect(reviewSpaceId.value).toBe(testReviewSpaceId);
        expect(errorMessage).toBeDefined();
        expect(typeof errorMessage).toBe("string");
        expect(mockCheckListItemRepository.bulkInsert).not.toHaveBeenCalled();
      });

      it("fileProcessingStep失敗時にエラーがReviewSpace.checklistGenerationErrorに保存されること", async () => {
        // Arrange
        const testFiles: RawUploadFileMeta[] = [createTestFileMeta("text", 0)];
        const checklistRequirements = "失敗テスト";

        // fileProcessingStepが失敗するようにモック
        mockFileProcessingStep.mockResolvedValue({
          status: "failed",
          errorMessage: "ファイル処理エラー",
        });

        // Act
        const taskDto = createTestChecklistTaskDto(
          testFiles,
          checklistRequirements,
        );
        const result = await executor.execute(taskDto);

        // Assert
        expect(result.success).toBe(false);
        expect(result.errorMessage).toContain("ファイル処理");
        // ReviewSpaceIdとエラーメッセージを詳細検証
        assertUpdateChecklistGenerationError(
          mockReviewSpaceRepository.updateChecklistGenerationError,
          testReviewSpaceId,
          "ファイル処理",
        );
        // エージェントは呼ばれない
        expect(mockTopicExtractionAgentGenerateLegacy).not.toHaveBeenCalled();
      });
    });

    describe("生成結果が空の場合の処理", () => {
      it("失敗として処理され適切なエラーメッセージが設定されること", async () => {
        // Arrange
        const testFiles: RawUploadFileMeta[] = [createTestFileMeta("text", 0)];
        const checklistRequirements = "空結果テスト";

        // トピック抽出は成功するが、チェックリスト作成で空になる
        mockTopicExtractionAgentGenerateLegacy.mockResolvedValue({
          object: {
            topics: [{ title: "トピック1", reason: "理由1" }],
          },
        });

        // 全てのトピックでチェックリスト項目が生成されない
        mockTopicChecklistAgentGenerateLegacy.mockResolvedValue({
          object: { checklistItems: [] }, // 空配列
        });

        // Act
        const taskDto = createTestChecklistTaskDto(
          testFiles,
          checklistRequirements,
        );
        const result = await executor.execute(taskDto);

        // Assert
        expect(result.success).toBe(false);
        expect(result.errorMessage).toBeDefined();
        // ReviewSpaceIdを詳細検証
        assertUpdateChecklistGenerationError(
          mockReviewSpaceRepository.updateChecklistGenerationError,
          testReviewSpaceId,
          "チェックリスト",
        );
      });

      it("トピックが0件の場合に失敗すること", async () => {
        // Arrange
        const testFiles: RawUploadFileMeta[] = [createTestFileMeta("text", 0)];
        const checklistRequirements = "空結果テスト";

        // トピック抽出で0件
        mockTopicExtractionAgentGenerateLegacy.mockResolvedValue({
          object: { topics: [] }, // 空配列
        });

        // Act
        const taskDto = createTestChecklistTaskDto(
          testFiles,
          checklistRequirements,
        );
        const result = await executor.execute(taskDto);

        // Assert
        expect(result.success).toBe(false);
        expect(result.errorMessage).toContain("トピックを抽出できませんでした");
      });
    });

    describe("サービス層でのバリデーションエラー", () => {
      it("ファイルが空の場合にエラーがスローされること", async () => {
        // Arrange
        const command: GenerateCheckListByAICommand = {
          reviewSpaceId: testReviewSpaceId,
          userId: testUserId,
          files: [], // 空のファイル配列
          fileBuffers: new Map(),
          checklistRequirements: "テスト",
        };

        // Act & Assert
        await expect(service.execute(command)).rejects.toThrow();
      });

      it("チェックリスト要件が空の場合にエラーがスローされること", async () => {
        // Arrange
        const testFiles: RawUploadFileMeta[] = [createTestFileMeta("text", 0)];
        const command: GenerateCheckListByAICommand = {
          reviewSpaceId: testReviewSpaceId,
          userId: testUserId,
          files: testFiles,
          fileBuffers: createTestFileBuffers(testFiles),
          checklistRequirements: "   ", // 空白のみ
        };

        // Act & Assert
        await expect(service.execute(command)).rejects.toThrow();
      });

      it("レビュースペースが存在しない場合にエラーがスローされること", async () => {
        // Arrange
        vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(null);

        const testFiles: RawUploadFileMeta[] = [createTestFileMeta("text", 0)];
        const command: GenerateCheckListByAICommand = {
          reviewSpaceId: testReviewSpaceId,
          userId: testUserId,
          files: testFiles,
          fileBuffers: createTestFileBuffers(testFiles),
          checklistRequirements: "テスト",
        };

        // Act & Assert
        await expect(service.execute(command)).rejects.toThrow();
      });

      it("プロジェクトへのアクセス権がない場合にエラーがスローされること", async () => {
        // Arrange
        const projectWithoutMember = Project.reconstruct({
          id: testProjectId,
          name: "テストプロジェクト",
          description: null,
          members: [
            { userId: "550e8400-e29b-41d4-a716-446655449999", createdAt: now },
          ], // testUserIdは含まれていない
          encryptedApiKey: null,
          createdAt: now,
          updatedAt: now,
        });
        vi.mocked(mockProjectRepository.findById).mockResolvedValue(
          projectWithoutMember,
        );

        const testFiles: RawUploadFileMeta[] = [createTestFileMeta("text", 0)];
        const command: GenerateCheckListByAICommand = {
          reviewSpaceId: testReviewSpaceId,
          userId: testUserId,
          files: testFiles,
          fileBuffers: createTestFileBuffers(testFiles),
          checklistRequirements: "テスト",
        };

        // Act & Assert
        await expect(service.execute(command)).rejects.toThrow();
      });
    });
  });

  describe("DB保存検証", () => {
    it("ICheckListItemRepository.bulkInsertが正しい引数で呼ばれること", async () => {
      // Arrange
      const testFiles: RawUploadFileMeta[] = [createTestFileMeta("text", 0)];
      const checklistRequirements = "DB保存テスト";

      mockTopicExtractionAgentGenerateLegacy.mockResolvedValue({
        object: {
          topics: [
            { title: "トピックA", reason: "理由A" },
            { title: "トピックB", reason: "理由B" },
          ],
        },
      });

      mockTopicChecklistAgentGenerateLegacy
        .mockResolvedValueOnce({
          object: { checklistItems: ["精査項目A", "精査項目B"] },
        })
        .mockResolvedValueOnce({ object: { checklistItems: ["精査項目C"] } });

      mockChecklistRefinementAgentGenerateLegacy.mockResolvedValue({
        object: { refinedChecklists: ["精査項目A", "精査項目B", "精査項目C"] },
      });

      // Act
      const taskDto = createTestChecklistTaskDto(
        testFiles,
        checklistRequirements,
      );
      const result = await executor.execute(taskDto);

      // Assert
      expect(result.success).toBe(true);
      expect(mockCheckListItemRepository.bulkInsert).toHaveBeenCalledTimes(1);

      const bulkInsertCall = vi.mocked(mockCheckListItemRepository.bulkInsert)
        .mock.calls[0];
      const savedItems = bulkInsertCall[0] as CheckListItem[];

      expect(savedItems.length).toBe(3);
      savedItems.forEach((item) => {
        expect(item.reviewSpaceId.value).toBe(testReviewSpaceId);
        expect(["精査項目A", "精査項目B", "精査項目C"]).toContain(
          item.content.value,
        );
      });
    });

    it("成功時にchecklistGenerationErrorがクリアされること", async () => {
      // Arrange
      const testFiles: RawUploadFileMeta[] = [createTestFileMeta("text", 0)];

      mockTopicExtractionAgentGenerateLegacy.mockResolvedValue({
        object: { topics: [{ title: "トピック1", reason: "理由1" }] },
      });

      mockTopicChecklistAgentGenerateLegacy.mockResolvedValue({
        object: { checklistItems: ["精査項目1"] },
      });

      mockChecklistRefinementAgentGenerateLegacy.mockResolvedValue({
        object: { refinedChecklists: ["精査項目1"] },
      });

      // Act
      const taskDto = createTestChecklistTaskDto(testFiles, "テスト");
      await executor.execute(taskDto);

      // Assert - ReviewSpaceIdも詳細検証
      assertUpdateChecklistGenerationError(
        mockReviewSpaceRepository.updateChecklistGenerationError,
        testReviewSpaceId,
        null,
      );
    });
  });
});
