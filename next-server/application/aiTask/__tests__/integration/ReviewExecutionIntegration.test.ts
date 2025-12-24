/**
 * レビュー実行 結合テスト
 *
 * ExecuteReviewService → AiTaskQueueService → AiTaskExecutor → reviewExecutionWorkflow → DB保存
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
  ExecuteReviewService,
  type ExecuteReviewCommand,
} from "@/application/reviewTarget/ExecuteReviewService";
import { AiTaskQueueService } from "@/application/aiTask/AiTaskQueueService";
import {
  AiTaskExecutor,
  type ReviewTaskPayload,
} from "@/application/aiTask/AiTaskExecutor";
import type { AiTaskDto, AiTask } from "@/domain/aiTask";
import { ReviewSpace } from "@/domain/reviewSpace";
import { ReviewTarget } from "@/domain/reviewTarget";
import { Project, ProjectId } from "@/domain/project";
import { CheckListItem } from "@/domain/checkListItem";
import type {
  RawUploadFileMeta,
  FileBuffersMap,
  ReviewType,
} from "@/application/mastra";
import { FILE_BUFFERS_CONTEXT_KEY } from "@/application/mastra";

// ========================================
// vi.hoistedでモック関数をホイスト
// ========================================
const {
  mockStartWorkersForApiKeyHash,
  // 少量レビュー用
  mockReviewExecuteAgentGenerateLegacy,
  mockChecklistCategoryAgentGenerateLegacy,
  // 大量レビュー用
  mockIndividualDocumentReviewAgentGenerateLegacy,
  mockConsolidateReviewAgentGenerateLegacy,
  // 共通
  mockFileProcessingStep,
} = vi.hoisted(() => ({
  mockStartWorkersForApiKeyHash: vi.fn(),
  mockReviewExecuteAgentGenerateLegacy: vi.fn(),
  mockChecklistCategoryAgentGenerateLegacy: vi.fn(),
  mockIndividualDocumentReviewAgentGenerateLegacy: vi.fn(),
  mockConsolidateReviewAgentGenerateLegacy: vi.fn(),
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
// ReviewCacheHelperのモック
// ========================================
vi.mock("@/lib/server/reviewCacheHelper", () => ({
  ReviewCacheHelper: {
    saveTextCache: vi.fn().mockResolvedValue("/mock/cache/text.json"),
    saveImageCache: vi.fn().mockResolvedValue("/mock/cache/image.json"),
    loadTextCache: vi.fn().mockResolvedValue("キャッシュされたテキスト"),
    loadImageCache: vi.fn().mockResolvedValue(["base64image1"]),
    deleteCache: vi.fn().mockResolvedValue(undefined),
  },
}));

// ========================================
// AIエージェントのモック（AI API呼び出しのみモック）
// ========================================
vi.mock("@/application/mastra/agents", () => ({
  // 少量レビュー用
  reviewExecuteAgent: {
    generateLegacy: (...args: unknown[]) =>
      mockReviewExecuteAgentGenerateLegacy(...args),
  },
  reviewResultItemSchema: {},
  reviewExecuteOutputSchema: {
    parse: vi.fn((v: unknown) => v),
  },
  // チェックリスト分類用
  checklistCategoryAgent: {
    generateLegacy: (...args: unknown[]) =>
      mockChecklistCategoryAgentGenerateLegacy(...args),
  },
  checklistCategoryOutputSchema: {
    parse: vi.fn((v: unknown) => v),
  },
  // 大量レビュー用
  individualDocumentReviewAgent: {
    generateLegacy: (...args: unknown[]) =>
      mockIndividualDocumentReviewAgentGenerateLegacy(...args),
  },
  individualDocumentReviewResultItemSchema: {},
  individualDocumentReviewOutputSchema: {
    parse: vi.fn((v: unknown) => v),
  },
  consolidateReviewAgent: {
    generateLegacy: (...args: unknown[]) =>
      mockConsolidateReviewAgentGenerateLegacy(...args),
  },
  consolidateReviewResultItemSchema: {},
  consolidateReviewOutputSchema: {
    parse: vi.fn((v: unknown) => v),
  },
  // チェックリスト生成用（結合テストでは使用しないがインポート互換性のため）
  topicExtractionAgent: {},
  topicExtractionOutputSchema: {},
  topicChecklistAgent: {},
  topicChecklistOutputSchema: {},
  checklistRefinementAgent: {},
  checklistRefinementOutputSchema: {},
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
  const reviewExecutionWorkflowModule = await vi.importActual<
    typeof import("@/application/mastra/workflows/reviewExecution")
  >("@/application/mastra/workflows/reviewExecution");

  return {
    // mastraオブジェクトのモック：実際のワークフローを返す
    mastra: {
      getWorkflow: vi.fn().mockImplementation((name: string) => {
        if (name === "reviewExecutionWorkflow") {
          return reviewExecutionWorkflowModule.reviewExecutionWorkflow;
        }
        return undefined;
      }),
    },
    // 実際のユーティリティ関数を使用
    checkWorkflowResult: workflowUtils.checkWorkflowResult,
    checkStatuses: workflowUtils.checkStatuses,
    // ワークフローとスキーマのエクスポート
    reviewExecutionWorkflow:
      reviewExecutionWorkflowModule.reviewExecutionWorkflow,
    rawUploadFileMetaSchema:
      reviewExecutionWorkflowModule.rawUploadFileMetaSchema,
    extractedFileSchema: reviewExecutionWorkflowModule.extractedFileSchema,
    FILE_BUFFERS_CONTEXT_KEY:
      reviewExecutionWorkflowModule.FILE_BUFFERS_CONTEXT_KEY,
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
 * テスト用チェックリスト項目を作成
 */
const createTestCheckListItems = (count: number): CheckListItem[] => {
  const items: CheckListItem[] = [];
  // UUID形式のIDを使用
  const checkListItemIds = [
    "550e8400-e29b-41d4-a716-446655440010",
    "550e8400-e29b-41d4-a716-446655440011",
    "550e8400-e29b-41d4-a716-446655440012",
    "550e8400-e29b-41d4-a716-446655440013",
    "550e8400-e29b-41d4-a716-446655440014",
  ];
  for (let i = 0; i < count; i++) {
    items.push(
      CheckListItem.reconstruct({
        id: checkListItemIds[i],
        reviewSpaceId: "550e8400-e29b-41d4-a716-446655440002",
        content: `チェック項目${i + 1}の内容`,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  }
  return items;
};

/**
 * RuntimeContext検証用ヘルパー
 */
interface RuntimeContextExpectations {
  shouldExist?: string[];
  shouldNotExist?: string[];
  exactValues?: Record<string, unknown>;
  shouldBeMap?: string[];
  mapSize?: Record<string, number>;
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
interface ExpectedReviewTaskPayload {
  taskType: string;
  reviewTargetId?: string;
  reviewSpaceId: string;
  userId: string;
  files: RawUploadFileMeta[];
  checkListItemCount: number;
  reviewType: ReviewType;
  aiApiConfig: { apiKey: string; apiUrl: string; apiModel: string };
}

const assertSavedReviewTaskPayload = (
  mockSave: ReturnType<typeof vi.fn>,
  expected: ExpectedReviewTaskPayload,
): void => {
  expect(mockSave).toHaveBeenCalledTimes(1);
  const savedTask = vi.mocked(mockSave).mock.calls[0][0] as AiTask;

  // タスクタイプ検証
  expect(savedTask.taskType.value).toBe(expected.taskType);

  // ペイロード検証
  const payload = savedTask.payload as unknown as ReviewTaskPayload;
  expect(payload.reviewSpaceId).toBe(expected.reviewSpaceId);
  expect(payload.userId).toBe(expected.userId);
  expect(payload.reviewType).toBe(expected.reviewType);
  expect(payload.aiApiConfig).toEqual(expected.aiApiConfig);

  // レビュー対象IDが存在することを確認
  expect(payload.reviewTargetId).toBeDefined();

  // チェックリスト項目数検証
  expect(payload.checkListItems).toHaveLength(expected.checkListItemCount);

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

// ========================================
// テスト本体
// ========================================
describe("レビュー実行 結合テスト", () => {
  // テスト用ID（UUID形式）
  const testUserId = "550e8400-e29b-41d4-a716-446655440000";
  const testEmployeeId = "test-employee-001";
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

  const testCheckListItems = createTestCheckListItems(3);

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
  let service: ExecuteReviewService;
  let executor: AiTaskExecutor;

  /**
   * テスト用のレビュータスクDtoを作成
   */
  const createTestReviewTaskDto = (
    files: RawUploadFileMeta[],
    checkListItems: Array<{ id: string; content: string }>,
    reviewType: ReviewType = "small",
  ): AiTaskDto => ({
    id: testTaskId,
    taskType: reviewType === "large" ? "large_review" : "small_review",
    status: "processing",
    apiKeyHash: "test-api-key-hash",
    priority: 5,
    payload: {
      reviewTargetId: "550e8400-e29b-41d4-a716-446655440004",
      reviewSpaceId: testReviewSpaceId,
      userId: testUserId,
      files,
      checkListItems,
      reviewSettings: {
        additionalInstructions: null,
        concurrentReviewItems: undefined,
        commentFormat: null,
        evaluationCriteria: [
          { label: "A", description: "要件を完全に満たしている" },
          { label: "B", description: "概ね要件を満たしている" },
          { label: "C", description: "改善が必要" },
          { label: "-", description: "評価対象外" },
        ],
      },
      reviewType,
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
    vi.mocked(mockSystemSettingRepository.find).mockResolvedValue(null);
    vi.mocked(mockAiTaskRepository.save).mockResolvedValue(undefined);
    vi.mocked(mockAiTaskRepository.countQueuedByApiKeyHash).mockResolvedValue(
      1,
    );
    vi.mocked(
      mockCheckListItemRepository.findByReviewSpaceId,
    ).mockResolvedValue(testCheckListItems);
    vi.mocked(mockReviewTargetRepository.save).mockResolvedValue(undefined);
    vi.mocked(mockReviewResultRepository.saveMany).mockResolvedValue(undefined);
    vi.mocked(mockReviewDocumentCacheRepository.save).mockResolvedValue(
      undefined,
    );

    // ReviewTarget.findByIdのモック
    vi.mocked(mockReviewTargetRepository.findById).mockImplementation(
      async () => {
        return ReviewTarget.reconstruct({
          id: "550e8400-e29b-41d4-a716-446655440004",
          reviewSpaceId: testReviewSpaceId,
          name: "テストレビュー対象",
          status: "queued",
          reviewSettings: null,
          reviewType: "small",
          createdAt: now,
          updatedAt: now,
        });
      },
    );

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

    // 少量レビューエージェントのデフォルトモック設定
    mockReviewExecuteAgentGenerateLegacy.mockResolvedValue({
      finishReason: "stop",
      object: [
        {
          checklistId: 1,
          reviewSections: [],
          comment: "レビューコメント1",
          evaluation: "A",
        },
        {
          checklistId: 2,
          reviewSections: [],
          comment: "レビューコメント2",
          evaluation: "B",
        },
        {
          checklistId: 3,
          reviewSections: [],
          comment: "レビューコメント3",
          evaluation: "A",
        },
      ],
    });

    // 大量レビューエージェントのデフォルトモック設定
    mockIndividualDocumentReviewAgentGenerateLegacy.mockResolvedValue({
      finishReason: "stop",
      object: [
        { checklistId: 1, reviewSections: [], comment: "個別コメント1" },
        { checklistId: 2, reviewSections: [], comment: "個別コメント2" },
        { checklistId: 3, reviewSections: [], comment: "個別コメント3" },
      ],
    });

    mockConsolidateReviewAgentGenerateLegacy.mockResolvedValue({
      finishReason: "stop",
      object: [
        { checklistId: 1, comment: "統合コメント1", evaluation: "A" },
        { checklistId: 2, comment: "統合コメント2", evaluation: "B" },
        { checklistId: 3, comment: "統合コメント3", evaluation: "A" },
      ],
    });

    // サービスとエグゼキューターの初期化
    queueService = new AiTaskQueueService(
      mockAiTaskRepository,
      mockAiTaskFileMetadataRepository,
    );

    service = new ExecuteReviewService(
      mockReviewTargetRepository,
      mockCheckListItemRepository,
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
  });

  describe("正常系 - 少量レビュー（reviewType: small）", () => {
    describe("テキストモードファイルでの一連の流れ", () => {
      it("サービス→キュー登録→エグゼキューター実行→DB保存が正常に動作すること", async () => {
        // Arrange
        const testFiles: RawUploadFileMeta[] = [createTestFileMeta("text", 0)];
        const testFileBuffers = createTestFileBuffers(testFiles);

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

        // Act 1: サービス経由でキュー登録
        const command: ExecuteReviewCommand = {
          reviewSpaceId: testReviewSpaceId,
          name: "テストレビュー対象",
          userId: testUserId,
          employeeId: testEmployeeId,
          files: testFiles,
          fileBuffers: testFileBuffers,
          reviewType: "small",
        };

        const enqueueResult = await service.execute(command);

        // Assert 1: キュー登録の検証
        expect(enqueueResult.status).toBe("queued");
        expect(mockStartWorkersForApiKeyHash).toHaveBeenCalled();

        // キュー登録ペイロードの詳細検証
        assertSavedReviewTaskPayload(vi.mocked(mockAiTaskRepository.save), {
          taskType: "small_review",
          reviewSpaceId: testReviewSpaceId,
          userId: testUserId,
          files: testFiles,
          checkListItemCount: 3,
          reviewType: "small",
          aiApiConfig: {
            apiKey: "test-api-key",
            apiUrl: "http://test-api-url",
            apiModel: "test-model",
          },
        });

        // Act 2: エグゼキューターでタスク実行
        const checkListItemsPayload = testCheckListItems.map((item) => ({
          id: item.id.value,
          content: item.content.value,
        }));
        const taskDto = createTestReviewTaskDto(
          testFiles,
          checkListItemsPayload,
          "small",
        );
        const executorResult = await executor.execute(taskDto);

        // Assert 2: 実行結果の検証
        expect(executorResult.success).toBe(true);

        // ワークフローの各ステップが実行されたことを確認
        expect(mockFileProcessingStep).toHaveBeenCalled();
        expect(mockReviewExecuteAgentGenerateLegacy).toHaveBeenCalledTimes(1);

        // レビュー対象ステータスがcompletedになることを確認
        const saveCallArgs = vi.mocked(mockReviewTargetRepository.save).mock
          .calls;
        const lastSaveCall = saveCallArgs[saveCallArgs.length - 1];
        const savedTarget = lastSaveCall[0] as ReviewTarget;
        expect(savedTarget.status.value).toBe("completed");
      });

      it("RuntimeContextにAI API設定が正しく設定されること", async () => {
        // Arrange
        const testFiles: RawUploadFileMeta[] = [createTestFileMeta("text", 0)];
        const checkListItemsPayload = testCheckListItems.map((item) => ({
          id: item.id.value,
          content: item.content.value,
        }));

        // エージェント呼び出し時にRuntimeContextをキャプチャ
        let capturedRuntimeContext: RuntimeContext | null = null;
        mockReviewExecuteAgentGenerateLegacy.mockImplementation(
          async (_message, options) => {
            capturedRuntimeContext = options.runtimeContext;
            return {
              finishReason: "stop",
              object: [
                {
                  checklistId: 1,
                  reviewSections: [],
                  comment: "コメント",
                  evaluation: "A",
                },
              ],
            };
          },
        );

        // Act
        const taskDto = createTestReviewTaskDto(
          testFiles,
          checkListItemsPayload,
          "small",
        );
        await executor.execute(taskDto);

        // Assert
        assertRuntimeContext(capturedRuntimeContext, {
          shouldExist: ["employeeId", "aiApiKey", "aiApiUrl", "aiApiModel"],
          exactValues: {
            employeeId: testUserId,
            aiApiKey: "test-api-key",
            aiApiUrl: "http://test-api-url",
            aiApiModel: "test-model",
          },
        });
      });

      it("RuntimeContextにファイルバッファが正しく設定されること", async () => {
        // Arrange
        const testFiles: RawUploadFileMeta[] = [
          createTestFileMeta("text", 0),
          createTestFileMeta("image", 1),
        ];
        const checkListItemsPayload = testCheckListItems.map((item) => ({
          id: item.id.value,
          content: item.content.value,
        }));

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

        // Act
        const taskDto = createTestReviewTaskDto(
          testFiles,
          checkListItemsPayload,
          "small",
        );
        await executor.execute(taskDto);

        // Assert
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
        const checkListItemsPayload = testCheckListItems.map((item) => ({
          id: item.id.value,
          content: item.content.value,
        }));

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

        // Act
        const taskDto = createTestReviewTaskDto(
          testFiles,
          checkListItemsPayload,
          "small",
        );
        const result = await executor.execute(taskDto);

        // Assert
        expect(result.success).toBe(true);

        // エージェントに画像が渡されていることを確認
        const reviewAgentCallArgs =
          mockReviewExecuteAgentGenerateLegacy.mock.calls[0];
        const message = reviewAgentCallArgs[0];
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
        const checkListItemsPayload = testCheckListItems.map((item) => ({
          id: item.id.value,
          content: item.content.value,
        }));

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

        // Act
        const taskDto = createTestReviewTaskDto(
          testFiles,
          checkListItemsPayload,
          "small",
        );
        const result = await executor.execute(taskDto);

        // Assert
        expect(result.success).toBe(true);

        // メッセージにテキストと画像の両方が含まれることを確認
        const reviewAgentCallArgs =
          mockReviewExecuteAgentGenerateLegacy.mock.calls[0];
        const message = reviewAgentCallArgs[0];
        expect(message.content).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ type: "text" }),
            expect.objectContaining({ type: "image" }),
          ]),
        );
      });
    });

    describe("レビュー設定の検証", () => {
      it("レビュー設定（additionalInstructions, commentFormat, evaluationCriteria）がRuntimeContextに設定されること", async () => {
        // Arrange
        const testFiles: RawUploadFileMeta[] = [createTestFileMeta("text", 0)];
        const checkListItemsPayload = testCheckListItems.map((item) => ({
          id: item.id.value,
          content: item.content.value,
        }));

        // エージェント呼び出し時にRuntimeContextをキャプチャ
        let capturedRuntimeContext: RuntimeContext | null = null;
        mockReviewExecuteAgentGenerateLegacy.mockImplementation(
          async (_message, options) => {
            capturedRuntimeContext = options.runtimeContext;
            return {
              finishReason: "stop",
              object: [
                {
                  checklistId: 1,
                  reviewSections: [],
                  comment: "コメント",
                  evaluation: "A",
                },
              ],
            };
          },
        );

        // Act
        const taskDto = createTestReviewTaskDto(
          testFiles,
          checkListItemsPayload,
          "small",
        );
        // reviewSettingsを設定
        (taskDto.payload as unknown as ReviewTaskPayload).reviewSettings = {
          additionalInstructions: "厳格にレビューしてください",
          commentFormat: "【問題点】\n【改善案】",
          evaluationCriteria: [
            { label: "A", description: "完璧" },
            { label: "B", description: "良好" },
          ],
        };

        await executor.execute(taskDto);

        // Assert
        expect(capturedRuntimeContext).not.toBeNull();
        expect(capturedRuntimeContext!.get("additionalInstructions")).toBe(
          "厳格にレビューしてください",
        );
        expect(capturedRuntimeContext!.get("commentFormat")).toBe(
          "【問題点】\n【改善案】",
        );
      });

      it("concurrentReviewItems指定時にchecklistCategoryAgentが呼ばれること", async () => {
        // Arrange
        const testFiles: RawUploadFileMeta[] = [createTestFileMeta("text", 0)];
        const checkListItemsPayload = testCheckListItems.map((item) => ({
          id: item.id.value,
          content: item.content.value,
        }));

        // カテゴリ分類エージェントのモック
        mockChecklistCategoryAgentGenerateLegacy.mockResolvedValue({
          finishReason: "stop",
          object: {
            categories: [
              { name: "セキュリティ", checklistIds: [1, 2] },
              { name: "その他", checklistIds: [3] },
            ],
          },
        });

        // 各チャンクのレビュー結果
        mockReviewExecuteAgentGenerateLegacy
          .mockResolvedValueOnce({
            finishReason: "stop",
            object: [
              {
                checklistId: 1,
                reviewSections: [],
                comment: "コメント1",
                evaluation: "A",
              },
              {
                checklistId: 2,
                reviewSections: [],
                comment: "コメント2",
                evaluation: "B",
              },
            ],
          })
          .mockResolvedValueOnce({
            finishReason: "stop",
            object: [
              {
                checklistId: 1,
                reviewSections: [],
                comment: "コメント3",
                evaluation: "A",
              },
            ],
          });

        // Act
        const taskDto = createTestReviewTaskDto(
          testFiles,
          checkListItemsPayload,
          "small",
        );
        // concurrentReviewItemsを設定
        (taskDto.payload as unknown as ReviewTaskPayload).reviewSettings = {
          ...((taskDto.payload as unknown as ReviewTaskPayload)
            .reviewSettings ?? {}),
          concurrentReviewItems: 2,
        };

        await executor.execute(taskDto);

        // Assert: AIカテゴリ分類が呼ばれる
        expect(mockChecklistCategoryAgentGenerateLegacy).toHaveBeenCalledTimes(
          1,
        );
        // 2つのチャンクに対してレビュー
        expect(mockReviewExecuteAgentGenerateLegacy).toHaveBeenCalledTimes(2);
      });
    });

    describe("DB保存検証", () => {
      it("レビュー結果がDBに正しく保存されること", async () => {
        // Arrange
        const testFiles: RawUploadFileMeta[] = [createTestFileMeta("text", 0)];
        const checkListItemsPayload = testCheckListItems.map((item) => ({
          id: item.id.value,
          content: item.content.value,
        }));

        // Act
        const taskDto = createTestReviewTaskDto(
          testFiles,
          checkListItemsPayload,
          "small",
        );
        await executor.execute(taskDto);

        // Assert: saveMany（レビュー結果保存）が呼ばれることを確認
        expect(mockReviewResultRepository.saveMany).toHaveBeenCalled();
      });

      it("ドキュメントキャッシュが保存されること", async () => {
        // Arrange
        const testFiles: RawUploadFileMeta[] = [createTestFileMeta("text", 0)];
        const checkListItemsPayload = testCheckListItems.map((item) => ({
          id: item.id.value,
          content: item.content.value,
        }));

        // Act
        const taskDto = createTestReviewTaskDto(
          testFiles,
          checkListItemsPayload,
          "small",
        );
        await executor.execute(taskDto);

        // Assert: save（ドキュメントキャッシュ保存）が呼ばれることを確認
        expect(mockReviewDocumentCacheRepository.save).toHaveBeenCalled();
      });

      it("成功時にレビュー対象ステータスがcompletedになること", async () => {
        // Arrange
        const testFiles: RawUploadFileMeta[] = [createTestFileMeta("text", 0)];
        const checkListItemsPayload = testCheckListItems.map((item) => ({
          id: item.id.value,
          content: item.content.value,
        }));

        // Act
        const taskDto = createTestReviewTaskDto(
          testFiles,
          checkListItemsPayload,
          "small",
        );
        await executor.execute(taskDto);

        // Assert
        const saveCallArgs = vi.mocked(mockReviewTargetRepository.save).mock
          .calls;
        const lastSaveCall = saveCallArgs[saveCallArgs.length - 1];
        const savedTarget = lastSaveCall[0] as ReviewTarget;
        expect(savedTarget.status.value).toBe("completed");
      });
    });
  });

  describe("正常系 - 大量レビュー（reviewType: large）", () => {
    it("複数ファイルの並列レビューと統合が成功すること", async () => {
      // Arrange
      const testFiles: RawUploadFileMeta[] = [
        createTestFileMeta("text", 0),
        createTestFileMeta("text", 1),
      ];
      const checkListItemsPayload = testCheckListItems.map((item) => ({
        id: item.id.value,
        content: item.content.value,
      }));

      // fileProcessingStepのモック
      mockFileProcessingStep.mockResolvedValue({
        status: "success",
        extractedFiles: [
          {
            id: "file-0",
            name: "test-0.txt",
            type: "text/plain",
            processMode: "text",
            textContent: "ドキュメント1の内容",
          },
          {
            id: "file-1",
            name: "test-1.txt",
            type: "text/plain",
            processMode: "text",
            textContent: "ドキュメント2の内容",
          },
        ],
      });

      // Act
      const taskDto = createTestReviewTaskDto(
        testFiles,
        checkListItemsPayload,
        "large",
      );
      const result = await executor.execute(taskDto);

      // Assert
      expect(result.success).toBe(true);

      // 個別レビューが2ファイル分呼ばれる
      expect(
        mockIndividualDocumentReviewAgentGenerateLegacy,
      ).toHaveBeenCalledTimes(2);

      // 統合レビューが1回呼ばれる
      expect(mockConsolidateReviewAgentGenerateLegacy).toHaveBeenCalledTimes(1);
    });

    it("統合結果がreview_resultsに保存されること", async () => {
      // Arrange
      const testFiles: RawUploadFileMeta[] = [createTestFileMeta("text", 0)];
      const checkListItemsPayload = testCheckListItems.map((item) => ({
        id: item.id.value,
        content: item.content.value,
      }));

      // Act
      const taskDto = createTestReviewTaskDto(
        testFiles,
        checkListItemsPayload,
        "large",
      );
      await executor.execute(taskDto);

      // Assert: saveMany（レビュー結果保存）が呼ばれることを確認
      expect(mockReviewResultRepository.saveMany).toHaveBeenCalled();
    });

    it("大量レビュー時に個別結果がキャッシュに保存されること", async () => {
      // Arrange
      const testFiles: RawUploadFileMeta[] = [
        createTestFileMeta("text", 0),
        createTestFileMeta("text", 1),
      ];
      const checkListItemsPayload = testCheckListItems.map((item) => ({
        id: item.id.value,
        content: item.content.value,
      }));

      // fileProcessingStepのモック
      mockFileProcessingStep.mockResolvedValue({
        status: "success",
        extractedFiles: [
          {
            id: "file-0",
            name: "test-0.txt",
            type: "text/plain",
            processMode: "text",
            textContent: "ドキュメント1の内容",
          },
          {
            id: "file-1",
            name: "test-1.txt",
            type: "text/plain",
            processMode: "text",
            textContent: "ドキュメント2の内容",
          },
        ],
      });

      // ドキュメントキャッシュを事前にモック設定（onIndividualResultsSavedで参照される）
      const mockDocumentCaches = [
        {
          id: { value: "cache-0" },
          fileName: "test-0.txt",
        },
        {
          id: { value: "cache-1" },
          fileName: "test-1.txt",
        },
      ];
      vi.mocked(
        mockReviewDocumentCacheRepository.findByReviewTargetId,
      ).mockResolvedValue(mockDocumentCaches as never);

      // レビュー結果をモック（onIndividualResultsSavedで参照される）
      const mockReviewResults = testCheckListItems.map((item, index) => ({
        id: { value: `result-${index}` },
        checkListItemContent: item.content.value,
      }));
      vi.mocked(
        mockReviewResultRepository.findByReviewTargetId,
      ).mockResolvedValue(mockReviewResults as never);

      // Act
      const taskDto = createTestReviewTaskDto(
        testFiles,
        checkListItemsPayload,
        "large",
      );
      await executor.execute(taskDto);

      // Assert: 個別結果キャッシュの保存が呼ばれることを確認
      expect(
        mockLargeDocumentResultCacheRepository.saveMany,
      ).toHaveBeenCalled();
    });
  });

  describe("キュー登録ペイロード検証", () => {
    it("少量レビュー時のペイロード構造が正しいこと", async () => {
      // Arrange
      const testFiles: RawUploadFileMeta[] = [createTestFileMeta("text", 0)];
      const testFileBuffers = createTestFileBuffers(testFiles);

      // Act
      const command: ExecuteReviewCommand = {
        reviewSpaceId: testReviewSpaceId,
        name: "テストレビュー対象",
        userId: testUserId,
        employeeId: testEmployeeId,
        files: testFiles,
        fileBuffers: testFileBuffers,
        reviewType: "small",
      };

      await service.execute(command);

      // Assert
      assertSavedReviewTaskPayload(vi.mocked(mockAiTaskRepository.save), {
        taskType: "small_review",
        reviewSpaceId: testReviewSpaceId,
        userId: testUserId,
        files: testFiles,
        checkListItemCount: 3,
        reviewType: "small",
        aiApiConfig: {
          apiKey: "test-api-key",
          apiUrl: "http://test-api-url",
          apiModel: "test-model",
        },
      });
    });

    it("大量レビュー時のペイロード構造が正しいこと", async () => {
      // Arrange
      const testFiles: RawUploadFileMeta[] = [createTestFileMeta("text", 0)];
      const testFileBuffers = createTestFileBuffers(testFiles);

      // Act
      const command: ExecuteReviewCommand = {
        reviewSpaceId: testReviewSpaceId,
        name: "テストレビュー対象",
        userId: testUserId,
        employeeId: testEmployeeId,
        files: testFiles,
        fileBuffers: testFileBuffers,
        reviewType: "large",
      };

      await service.execute(command);

      // Assert
      assertSavedReviewTaskPayload(vi.mocked(mockAiTaskRepository.save), {
        taskType: "large_review",
        reviewSpaceId: testReviewSpaceId,
        userId: testUserId,
        files: testFiles,
        checkListItemCount: 3,
        reviewType: "large",
        aiApiConfig: {
          apiKey: "test-api-key",
          apiUrl: "http://test-api-url",
          apiModel: "test-model",
        },
      });
    });
  });

  describe("異常系", () => {
    describe("ワークフロー失敗時のエラーハンドリング", () => {
      it("fileProcessingStep失敗時にエラーステータスになること", async () => {
        // Arrange
        const testFiles: RawUploadFileMeta[] = [createTestFileMeta("text", 0)];
        const checkListItemsPayload = testCheckListItems.map((item) => ({
          id: item.id.value,
          content: item.content.value,
        }));

        // fileProcessingStepが失敗するようにモック
        mockFileProcessingStep.mockResolvedValue({
          status: "failed",
          errorMessage: "ファイル処理エラー",
        });

        // Act
        const taskDto = createTestReviewTaskDto(
          testFiles,
          checkListItemsPayload,
          "small",
        );
        const result = await executor.execute(taskDto);

        // Assert
        expect(result.success).toBe(false);
        expect(result.errorMessage).toContain("ファイル処理");

        // レビュー対象ステータスがerrorになることを確認
        const saveCallArgs = vi.mocked(mockReviewTargetRepository.save).mock
          .calls;
        const lastSaveCall = saveCallArgs[saveCallArgs.length - 1];
        const savedTarget = lastSaveCall[0] as ReviewTarget;
        expect(savedTarget.status.value).toBe("error");
      });

      it("AIエージェントエラー時にエラーが記録されること", async () => {
        // Arrange
        const testFiles: RawUploadFileMeta[] = [createTestFileMeta("text", 0)];
        const checkListItemsPayload = testCheckListItems.map((item) => ({
          id: item.id.value,
          content: item.content.value,
        }));

        // AIエージェントが例外をスローするようにモック
        mockReviewExecuteAgentGenerateLegacy.mockRejectedValue(
          new Error("AI APIエラー"),
        );

        // Act
        const taskDto = createTestReviewTaskDto(
          testFiles,
          checkListItemsPayload,
          "small",
        );
        const result = await executor.execute(taskDto);

        // Assert: workflowは全チェック項目がエラーなので失敗
        expect(result.success).toBe(false);
      });

      it("全てのチェック項目がエラーの場合にワークフローが失敗すること", async () => {
        // Arrange
        const testFiles: RawUploadFileMeta[] = [createTestFileMeta("text", 0)];
        const checkListItemsPayload = testCheckListItems.map((item) => ({
          id: item.id.value,
          content: item.content.value,
        }));

        // 常に空配列を返す
        mockReviewExecuteAgentGenerateLegacy.mockResolvedValue({
          finishReason: "stop",
          object: [],
        });

        // Act
        const taskDto = createTestReviewTaskDto(
          testFiles,
          checkListItemsPayload,
          "small",
        );
        const result = await executor.execute(taskDto);

        // Assert
        expect(result.success).toBe(false);
      });
    });

    describe("サービス層でのバリデーションエラー", () => {
      it("ファイルが空の場合にエラーがスローされること", async () => {
        // Arrange
        const command: ExecuteReviewCommand = {
          reviewSpaceId: testReviewSpaceId,
          name: "テストレビュー対象",
          userId: testUserId,
          employeeId: testEmployeeId,
          files: [], // 空のファイル配列
          fileBuffers: new Map(),
          reviewType: "small",
        };

        // Act & Assert: ファイル未選択エラーがスローされること
        await expect(service.execute(command)).rejects.toThrow(
          /ファイルが選択されていません/,
        );
      });

      it("チェックリストが空の場合にエラーがスローされること", async () => {
        // Arrange
        vi.mocked(
          mockCheckListItemRepository.findByReviewSpaceId,
        ).mockResolvedValue([]); // 空のチェックリスト

        const testFiles: RawUploadFileMeta[] = [createTestFileMeta("text", 0)];
        const command: ExecuteReviewCommand = {
          reviewSpaceId: testReviewSpaceId,
          name: "テストレビュー対象",
          userId: testUserId,
          employeeId: testEmployeeId,
          files: testFiles,
          fileBuffers: createTestFileBuffers(testFiles),
          reviewType: "small",
        };

        // Act & Assert: チェックリスト未登録エラーがスローされること
        await expect(service.execute(command)).rejects.toThrow(
          /チェックリストがありません/,
        );
      });

      it("レビュースペースが存在しない場合にエラーがスローされること", async () => {
        // Arrange
        vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(null);

        const testFiles: RawUploadFileMeta[] = [createTestFileMeta("text", 0)];
        const command: ExecuteReviewCommand = {
          reviewSpaceId: testReviewSpaceId,
          name: "テストレビュー対象",
          userId: testUserId,
          employeeId: testEmployeeId,
          files: testFiles,
          fileBuffers: createTestFileBuffers(testFiles),
          reviewType: "small",
        };

        // Act & Assert: レビュースペース未存在エラーがスローされること
        await expect(service.execute(command)).rejects.toThrow(
          /指定されたレビュースペースが見つかりません/,
        );
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
        const command: ExecuteReviewCommand = {
          reviewSpaceId: testReviewSpaceId,
          name: "テストレビュー対象",
          userId: testUserId,
          employeeId: testEmployeeId,
          files: testFiles,
          fileBuffers: createTestFileBuffers(testFiles),
          reviewType: "small",
        };

        // Act & Assert: アクセス権エラーがスローされること
        await expect(service.execute(command)).rejects.toThrow(
          /このプロジェクトへのアクセス権がありません/,
        );
      });
    });
  });
});
