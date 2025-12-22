/**
 * レビューリトライ 結合テスト
 *
 * RetryReviewService → AiTaskQueueService → AiTaskExecutor → reviewExecutionWorkflow → DB保存
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
  RetryReviewService,
  type RetryReviewCommand,
} from "@/application/reviewTarget/RetryReviewService";
import { AiTaskQueueService } from "@/application/aiTask/AiTaskQueueService";
import {
  AiTaskExecutor,
  type ReviewTaskPayload,
} from "@/application/aiTask/AiTaskExecutor";
import type { AiTaskDto, AiTask } from "@/domain/aiTask";
import { ReviewSpace } from "@/domain/reviewSpace";
import { ReviewTarget, ReviewDocumentCache } from "@/domain/reviewTarget";
import { ReviewResult } from "@/domain/reviewResult";
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
    loadTextCache: vi
      .fn()
      .mockResolvedValue("キャッシュされたテキストドキュメント"),
    loadImageCache: vi
      .fn()
      .mockResolvedValue(["base64cachedimage1", "base64cachedimage2"]),
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
 * テスト用チェックリスト項目を作成
 */
const createTestCheckListItems = (
  count: number,
  reviewSpaceId: string,
): CheckListItem[] => {
  const items: CheckListItem[] = [];
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
        reviewSpaceId,
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
 * リトライ用ペイロード検証ヘルパー
 */
interface ExpectedRetryTaskPayload {
  taskType: string;
  reviewTargetId: string;
  reviewSpaceId: string;
  userId: string;
  checkListItemCount: number;
  reviewType: ReviewType;
  aiApiConfig: { apiKey: string; apiUrl: string; apiModel: string };
  isRetry: boolean;
  retryScope: "failed" | "all";
  resultsToDeleteCount: number;
}

const assertSavedRetryTaskPayload = (
  mockSave: ReturnType<typeof vi.fn>,
  expected: ExpectedRetryTaskPayload,
): void => {
  expect(mockSave).toHaveBeenCalledTimes(1);
  const savedTask = vi.mocked(mockSave).mock.calls[0][0] as AiTask;

  // タスクタイプ検証
  expect(savedTask.taskType.value).toBe(expected.taskType);

  // ペイロード検証
  const payload = savedTask.payload as unknown as ReviewTaskPayload;
  expect(payload.reviewTargetId).toBe(expected.reviewTargetId);
  expect(payload.reviewSpaceId).toBe(expected.reviewSpaceId);
  expect(payload.userId).toBe(expected.userId);
  expect(payload.reviewType).toBe(expected.reviewType);
  expect(payload.aiApiConfig).toEqual(expected.aiApiConfig);

  // リトライ固有フィールド検証
  expect(payload.isRetry).toBe(expected.isRetry);
  expect(payload.retryScope).toBe(expected.retryScope);
  expect(payload.files).toEqual([]); // リトライ時は空配列
  expect(payload.resultsToDeleteIds).toHaveLength(
    expected.resultsToDeleteCount,
  );

  // チェックリスト項目数検証
  expect(payload.checkListItems).toHaveLength(expected.checkListItemCount);
};

// ========================================
// テスト本体
// ========================================
describe("レビューリトライ 結合テスト", () => {
  // テスト用ID（UUID形式）
  const testUserId = "550e8400-e29b-41d4-a716-446655440000";
  const testProjectId = "550e8400-e29b-41d4-a716-446655440001";
  const testReviewSpaceId = "550e8400-e29b-41d4-a716-446655440002";
  const testTaskId = "550e8400-e29b-41d4-a716-446655440003";
  const testReviewTargetId = "550e8400-e29b-41d4-a716-446655440004";
  const testCacheId1 = "550e8400-e29b-41d4-a716-446655440005";
  const testCacheId2 = "550e8400-e29b-41d4-a716-446655440006";
  const testResultId1 = "550e8400-e29b-41d4-a716-446655440020";
  const testResultId2 = "550e8400-e29b-41d4-a716-446655440021";
  const testResultId3 = "550e8400-e29b-41d4-a716-446655440022";

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

  const testCheckListItems = createTestCheckListItems(3, testReviewSpaceId);

  /**
   * テスト用ドキュメントキャッシュを作成
   */
  const createTestDocumentCaches = (): ReviewDocumentCache[] => [
    ReviewDocumentCache.reconstruct({
      id: testCacheId1,
      reviewTargetId: testReviewTargetId,
      fileName: "test-0.txt",
      processMode: "text",
      cachePath: "/cache/path/test1.json",
      createdAt: now,
    }),
    ReviewDocumentCache.reconstruct({
      id: testCacheId2,
      reviewTargetId: testReviewTargetId,
      fileName: "test-1.pdf",
      processMode: "image",
      cachePath: "/cache/path/test2.json",
      createdAt: now,
    }),
  ];

  /**
   * テスト用レビュー結果を作成（成功・失敗混合）
   */
  const createTestReviewResults = (
    failedIndices: number[] = [],
  ): ReviewResult[] => {
    const results: ReviewResult[] = [];
    const resultIds = [testResultId1, testResultId2, testResultId3];
    for (let i = 0; i < 3; i++) {
      const isFailed = failedIndices.includes(i);
      results.push(
        ReviewResult.reconstruct({
          id: resultIds[i],
          reviewTargetId: testReviewTargetId,
          checkListItemContent: `チェック項目${i + 1}の内容`,
          evaluation: isFailed ? null : "A",
          comment: isFailed ? null : `レビューコメント${i + 1}`,
          errorMessage: isFailed ? "AI処理エラー" : null,
          createdAt: now,
          updatedAt: now,
        }),
      );
    }
    return results;
  };

  /**
   * リトライ可能なレビュー対象を作成（completed状態）
   */
  const createCompletedReviewTarget = (
    reviewType: ReviewType = "small",
  ): ReviewTarget => {
    return ReviewTarget.reconstruct({
      id: testReviewTargetId,
      reviewSpaceId: testReviewSpaceId,
      name: "テストレビュー対象",
      status: "completed",
      reviewType,
      reviewSettings: null,
      createdAt: now,
      updatedAt: now,
    });
  };

  /**
   * queued状態のレビュー対象を作成（executor用）
   */
  const createQueuedReviewTarget = (
    reviewType: ReviewType = "small",
  ): ReviewTarget => {
    return ReviewTarget.reconstruct({
      id: testReviewTargetId,
      reviewSpaceId: testReviewSpaceId,
      name: "テストレビュー対象",
      status: "queued",
      reviewType,
      reviewSettings: null,
      createdAt: now,
      updatedAt: now,
    });
  };

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
  let retryService: RetryReviewService;
  let executor: AiTaskExecutor;

  /**
   * テスト用のリトライタスクDtoを作成
   */
  const createTestRetryTaskDto = (
    checkListItems: Array<{ id: string; content: string }>,
    reviewType: ReviewType = "small",
    resultsToDeleteIds: string[] = [],
    retryScope: "failed" | "all" = "failed",
  ): AiTaskDto => ({
    id: testTaskId,
    taskType: reviewType === "large" ? "large_review" : "small_review",
    status: "processing",
    apiKeyHash: "test-api-key-hash",
    priority: 5,
    payload: {
      reviewTargetId: testReviewTargetId,
      reviewSpaceId: testReviewSpaceId,
      userId: testUserId,
      files: [], // リトライ時は空配列
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
      // リトライ固有フィールド
      isRetry: true,
      retryScope,
      resultsToDeleteIds,
    } as Record<string, unknown>,
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
    startedAt: now,
    completedAt: null,
    fileMetadata: [], // リトライ時はファイルメタデータなし
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
    vi.mocked(mockReviewResultRepository.delete).mockResolvedValue(undefined);
    vi.mocked(mockReviewDocumentCacheRepository.save).mockResolvedValue(
      undefined,
    );
    vi.mocked(
      mockReviewDocumentCacheRepository.findByReviewTargetId,
    ).mockResolvedValue(createTestDocumentCaches());

    // ワーカー起動モック
    mockStartWorkersForApiKeyHash.mockResolvedValue(undefined);

    // fileProcessingStepのデフォルトモック設定（キャッシュモードではスキップされるが互換性のため）
    mockFileProcessingStep.mockResolvedValue({
      status: "success",
      extractedFiles: [
        {
          id: "file-0",
          name: "test-0.txt",
          type: "text/plain",
          processMode: "text",
          textContent: "キャッシュされたテキストドキュメント",
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
          comment: "リトライレビューコメント1",
          evaluation: "A",
        },
        {
          checklistId: 2,
          reviewSections: [],
          comment: "リトライレビューコメント2",
          evaluation: "B",
        },
        {
          checklistId: 3,
          reviewSections: [],
          comment: "リトライレビューコメント3",
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

    retryService = new RetryReviewService(
      mockReviewTargetRepository,
      mockReviewResultRepository,
      mockCheckListItemRepository,
      mockReviewSpaceRepository,
      mockProjectRepository,
      mockReviewDocumentCacheRepository,
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
    describe("失敗項目のみリトライ（retryScope: failed）", () => {
      it("サービス→キュー登録→エグゼキューター実行→DB保存が正常に動作すること", async () => {
        // Arrange: 1件失敗のレビュー結果を設定
        const testResults = createTestReviewResults([1]); // インデックス1が失敗
        vi.mocked(
          mockReviewResultRepository.findByReviewTargetId,
        ).mockResolvedValue(testResults);
        vi.mocked(mockReviewTargetRepository.findById)
          .mockResolvedValueOnce(createCompletedReviewTarget()) // サービス用
          .mockResolvedValue(createQueuedReviewTarget()); // エグゼキューター用

        // Act 1: サービス経由でキュー登録
        const command: RetryReviewCommand = {
          reviewTargetId: testReviewTargetId,
          userId: testUserId,
          retryScope: "failed",
        };

        const enqueueResult = await retryService.execute(command);

        // Assert 1: キュー登録の検証
        expect(enqueueResult.status).toBe("queued");
        expect(enqueueResult.retryItems).toBe(1); // 失敗項目は1つ
        expect(mockStartWorkersForApiKeyHash).toHaveBeenCalled();

        // キュー登録ペイロードの詳細検証
        assertSavedRetryTaskPayload(vi.mocked(mockAiTaskRepository.save), {
          taskType: "small_review",
          reviewTargetId: testReviewTargetId,
          reviewSpaceId: testReviewSpaceId,
          userId: testUserId,
          checkListItemCount: 1, // 失敗項目のみ
          reviewType: "small",
          aiApiConfig: {
            apiKey: "test-api-key",
            apiUrl: "http://test-api-url",
            apiModel: "test-model",
          },
          isRetry: true,
          retryScope: "failed",
          resultsToDeleteCount: 1, // 削除対象は1つ
        });

        // チェックリスト項目の内容も検証
        const savedTask = vi.mocked(mockAiTaskRepository.save).mock
          .calls[0][0] as AiTask;
        const payload = savedTask.payload as unknown as ReviewTaskPayload;
        expect(payload.checkListItems[0].content).toBe("チェック項目2の内容"); // 失敗項目のcontentを検証

        // Act 2: エグゼキューターでタスク実行
        const failedItem = {
          id: "retry-0",
          content: "チェック項目2の内容", // 失敗した項目
        };
        const taskDto = createTestRetryTaskDto([failedItem], "small", [
          testResultId2,
        ]);
        const executorResult = await executor.execute(taskDto);

        // Assert 2: 実行結果の検証
        expect(executorResult.success).toBe(true);

        // 削除対象のレビュー結果が削除されることを確認
        expect(mockReviewResultRepository.delete).toHaveBeenCalledTimes(1);

        // レビュー対象ステータスがcompletedになることを確認
        const saveCallArgs = vi.mocked(mockReviewTargetRepository.save).mock
          .calls;
        const lastSaveCall = saveCallArgs[saveCallArgs.length - 1];
        const savedTarget = lastSaveCall[0] as ReviewTarget;
        expect(savedTarget.status.value).toBe("completed");
      });
    });

    describe("全項目リトライ（retryScope: all）- スナップショット使用", () => {
      it("前回チェックリストを使用して全項目リトライが正常に動作すること", async () => {
        // Arrange
        const testResults = createTestReviewResults([1]); // 1件失敗
        vi.mocked(
          mockReviewResultRepository.findByReviewTargetId,
        ).mockResolvedValue(testResults);
        vi.mocked(mockReviewTargetRepository.findById)
          .mockResolvedValueOnce(createCompletedReviewTarget())
          .mockResolvedValue(createQueuedReviewTarget());

        // Act 1: サービス経由でキュー登録
        const command: RetryReviewCommand = {
          reviewTargetId: testReviewTargetId,
          userId: testUserId,
          retryScope: "all",
          useLatestChecklist: false, // スナップショット使用
        };

        const enqueueResult = await retryService.execute(command);

        // Assert 1: キュー登録の検証
        expect(enqueueResult.status).toBe("queued");
        expect(enqueueResult.retryItems).toBe(3); // 全項目

        // 最新チェックリストは取得されないことを確認
        expect(
          mockCheckListItemRepository.findByReviewSpaceId,
        ).not.toHaveBeenCalled();

        // ペイロード検証
        const savedTask = vi.mocked(mockAiTaskRepository.save).mock
          .calls[0][0] as AiTask;
        const payload = savedTask.payload as unknown as ReviewTaskPayload;
        expect(payload.resultsToDeleteIds).toHaveLength(3); // 全削除対象
        expect(payload.retryScope).toBe("all"); // リトライ範囲が正しく設定されていること

        // Act 2: エグゼキューターでタスク実行
        const allItems = [
          { id: "snapshot-0", content: "チェック項目1の内容" },
          { id: "snapshot-1", content: "チェック項目2の内容" },
          { id: "snapshot-2", content: "チェック項目3の内容" },
        ];
        const taskDto = createTestRetryTaskDto(
          allItems,
          "small",
          [testResultId1, testResultId2, testResultId3],
          "all",
        );
        const executorResult = await executor.execute(taskDto);

        // Assert 2: 実行結果の検証
        expect(executorResult.success).toBe(true);
        expect(mockReviewResultRepository.delete).toHaveBeenCalledTimes(3);
      });
    });

    describe("全項目リトライ（retryScope: all）- 最新チェックリスト使用", () => {
      it("最新チェックリストを使用して全項目リトライが正常に動作すること", async () => {
        // Arrange
        const testResults = createTestReviewResults([1]); // 1件失敗
        vi.mocked(
          mockReviewResultRepository.findByReviewTargetId,
        ).mockResolvedValue(testResults);
        vi.mocked(mockReviewTargetRepository.findById)
          .mockResolvedValueOnce(createCompletedReviewTarget())
          .mockResolvedValue(createQueuedReviewTarget());

        // Act 1: サービス経由でキュー登録
        const command: RetryReviewCommand = {
          reviewTargetId: testReviewTargetId,
          userId: testUserId,
          retryScope: "all",
          useLatestChecklist: true, // 最新チェックリスト使用
        };

        const enqueueResult = await retryService.execute(command);

        // Assert 1: キュー登録の検証
        expect(enqueueResult.status).toBe("queued");
        expect(enqueueResult.retryItems).toBe(3);

        // 最新チェックリストが取得されることを確認
        expect(
          mockCheckListItemRepository.findByReviewSpaceId,
        ).toHaveBeenCalled();

        // ペイロードのチェックリストが最新のものであることを確認
        const savedTask = vi.mocked(mockAiTaskRepository.save).mock
          .calls[0][0] as AiTask;
        const payload = savedTask.payload as unknown as ReviewTaskPayload;
        expect(payload.checkListItems[0].id).toBe(
          "550e8400-e29b-41d4-a716-446655440010",
        );
      });
    });
  });

  describe("正常系 - 大量レビュー（reviewType: large）", () => {
    describe("失敗項目のみリトライ", () => {
      it("大量レビューの失敗項目のみリトライが正常に動作すること", async () => {
        // Arrange
        const testResults = createTestReviewResults([1]); // インデックス1が失敗
        vi.mocked(
          mockReviewResultRepository.findByReviewTargetId,
        ).mockResolvedValue(testResults);
        vi.mocked(mockReviewTargetRepository.findById)
          .mockResolvedValueOnce(createCompletedReviewTarget("large"))
          .mockResolvedValue(createQueuedReviewTarget("large"));

        // fileProcessingStepが複数ファイルを返すようにモック
        mockFileProcessingStep.mockResolvedValue({
          status: "success",
          extractedFiles: [
            {
              id: "file-0",
              name: "test-0.txt",
              type: "text/plain",
              processMode: "text",
              textContent: "キャッシュされたテキスト1",
            },
            {
              id: "file-1",
              name: "test-1.pdf",
              type: "application/pdf",
              processMode: "image",
              imageData: ["base64cachedimage1", "base64cachedimage2"],
            },
          ],
        });

        // Act 1: サービス経由でキュー登録
        const command: RetryReviewCommand = {
          reviewTargetId: testReviewTargetId,
          userId: testUserId,
          retryScope: "failed",
          reviewType: "large", // 大量レビュー
        };

        const enqueueResult = await retryService.execute(command);

        // Assert 1: キュー登録の検証
        expect(enqueueResult.status).toBe("queued");
        expect(enqueueResult.retryItems).toBe(1);

        // タスクタイプがLARGE_REVIEWになることを確認
        const savedTask = vi.mocked(mockAiTaskRepository.save).mock
          .calls[0][0] as AiTask;
        expect(savedTask.taskType.value).toBe("large_review");

        // Act 2: エグゼキューターでタスク実行
        const failedItem = {
          id: "retry-0",
          content: "チェック項目2の内容",
        };
        const taskDto = createTestRetryTaskDto([failedItem], "large", [
          testResultId2,
        ]);
        (taskDto.payload as unknown as ReviewTaskPayload).retryScope = "failed";
        const executorResult = await executor.execute(taskDto);

        // Assert 2: 実行結果の検証
        expect(executorResult.success).toBe(true);

        // 個別レビューエージェントが呼ばれることを確認
        expect(
          mockIndividualDocumentReviewAgentGenerateLegacy,
        ).toHaveBeenCalled();

        // 統合レビューエージェントが呼ばれることを確認
        expect(mockConsolidateReviewAgentGenerateLegacy).toHaveBeenCalled();
      });
    });

    describe("全項目リトライ", () => {
      it("大量レビューの全項目リトライが正常に動作すること", async () => {
        // Arrange
        const testResults = createTestReviewResults([]); // 全て成功
        vi.mocked(
          mockReviewResultRepository.findByReviewTargetId,
        ).mockResolvedValue(testResults);
        vi.mocked(mockReviewTargetRepository.findById)
          .mockResolvedValueOnce(createCompletedReviewTarget("large"))
          .mockResolvedValue(createQueuedReviewTarget("large"));

        // Act 1: サービス経由でキュー登録
        const command: RetryReviewCommand = {
          reviewTargetId: testReviewTargetId,
          userId: testUserId,
          retryScope: "all",
          reviewType: "large",
        };

        const enqueueResult = await retryService.execute(command);

        // Assert 1: キュー登録の検証
        expect(enqueueResult.status).toBe("queued");
        expect(enqueueResult.retryItems).toBe(3); // 全項目

        // 全削除対象が含まれることを確認
        const savedTask = vi.mocked(mockAiTaskRepository.save).mock
          .calls[0][0] as AiTask;
        const payload = savedTask.payload as unknown as ReviewTaskPayload;
        expect(payload.resultsToDeleteIds).toHaveLength(3);
        expect(payload.retryScope).toBe("all");

        // Act 2: エグゼキューターでタスク実行
        const allItems = [
          { id: "snapshot-0", content: "チェック項目1の内容" },
          { id: "snapshot-1", content: "チェック項目2の内容" },
          { id: "snapshot-2", content: "チェック項目3の内容" },
        ];
        const taskDto = createTestRetryTaskDto(
          allItems,
          "large",
          [testResultId1, testResultId2, testResultId3],
          "all",
        );
        const executorResult = await executor.execute(taskDto);

        // Assert 2: 実行結果の検証
        expect(executorResult.success).toBe(true);
        expect(mockReviewResultRepository.delete).toHaveBeenCalledTimes(3);

        // 個別レビューエージェントが呼ばれることを確認
        expect(
          mockIndividualDocumentReviewAgentGenerateLegacy,
        ).toHaveBeenCalled();

        // 統合レビューエージェントが呼ばれることを確認
        expect(mockConsolidateReviewAgentGenerateLegacy).toHaveBeenCalled();
      });
    });
  });

  describe("正常系 - レビュー設定変更リトライ", () => {
    it("レビュー設定を変更してリトライできること", async () => {
      // Arrange
      const testResults = createTestReviewResults([1]);
      vi.mocked(
        mockReviewResultRepository.findByReviewTargetId,
      ).mockResolvedValue(testResults);
      vi.mocked(mockReviewTargetRepository.findById)
        .mockResolvedValueOnce(createCompletedReviewTarget())
        .mockResolvedValue(createQueuedReviewTarget());

      // RuntimeContextをキャプチャ
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

      // Act 1: サービス経由でキュー登録（レビュー設定変更）
      const command: RetryReviewCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
        retryScope: "failed",
        reviewSettings: {
          additionalInstructions: "セキュリティに注意してレビュー",
          concurrentReviewItems: 2,
          commentFormat: "【問題点】\n【改善案】",
        },
      };

      await retryService.execute(command);

      // ペイロードにレビュー設定が反映されることを確認
      const savedTask = vi.mocked(mockAiTaskRepository.save).mock
        .calls[0][0] as AiTask;
      const payload = savedTask.payload as unknown as ReviewTaskPayload;
      expect(payload.reviewSettings?.additionalInstructions).toBe(
        "セキュリティに注意してレビュー",
      );
      expect(payload.reviewSettings?.concurrentReviewItems).toBe(2);
      expect(payload.reviewSettings?.commentFormat).toBe(
        "【問題点】\n【改善案】",
      );

      // Act 2: エグゼキューターでタスク実行
      const failedItem = { id: "retry-0", content: "チェック項目2の内容" };
      const taskDto = createTestRetryTaskDto([failedItem], "small", [
        testResultId2,
      ]);
      (taskDto.payload as unknown as ReviewTaskPayload).reviewSettings = {
        additionalInstructions: "セキュリティに注意してレビュー",
        concurrentReviewItems: 2,
        commentFormat: "【問題点】\n【改善案】",
        evaluationCriteria: [],
      };
      await executor.execute(taskDto);

      // Assert: RuntimeContextに設定が反映されることを確認
      expect(capturedRuntimeContext).not.toBeNull();
      expect(capturedRuntimeContext!.get("additionalInstructions")).toBe(
        "セキュリティに注意してレビュー",
      );
      expect(capturedRuntimeContext!.get("commentFormat")).toBe(
        "【問題点】\n【改善案】",
      );
    });
  });

  describe("正常系 - レビュー種別変更リトライ", () => {
    it("レビュー種別を変更（small→large）してリトライできること", async () => {
      // Arrange: 元はsmallレビューで完了
      const testResults = createTestReviewResults([1]);
      vi.mocked(
        mockReviewResultRepository.findByReviewTargetId,
      ).mockResolvedValue(testResults);
      vi.mocked(mockReviewTargetRepository.findById)
        .mockResolvedValueOnce(createCompletedReviewTarget("small")) // 元はsmall
        .mockResolvedValue(createQueuedReviewTarget("large")); // largeに変更

      // Act: レビュー種別を変更してリトライ
      const command: RetryReviewCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
        retryScope: "all",
        reviewType: "large", // small→largeに変更
      };

      const enqueueResult = await retryService.execute(command);

      // Assert: タスクタイプがLARGE_REVIEWになること
      expect(enqueueResult.status).toBe("queued");
      const savedTask = vi.mocked(mockAiTaskRepository.save).mock
        .calls[0][0] as AiTask;
      expect(savedTask.taskType.value).toBe("large_review");
      const payload = savedTask.payload as unknown as ReviewTaskPayload;
      expect(payload.reviewType).toBe("large");
    });

    it("レビュー種別を変更（large→small）してリトライできること", async () => {
      // Arrange: 元はlargeレビューで完了
      const testResults = createTestReviewResults([1]);
      vi.mocked(
        mockReviewResultRepository.findByReviewTargetId,
      ).mockResolvedValue(testResults);
      vi.mocked(mockReviewTargetRepository.findById)
        .mockResolvedValueOnce(createCompletedReviewTarget("large")) // 元はlarge
        .mockResolvedValue(createQueuedReviewTarget("small")); // smallに変更

      // Act: レビュー種別を変更してリトライ
      const command: RetryReviewCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
        retryScope: "failed",
        reviewType: "small", // large→smallに変更
      };

      const enqueueResult = await retryService.execute(command);

      // Assert: タスクタイプがSMALL_REVIEWになること
      expect(enqueueResult.status).toBe("queued");
      const savedTask = vi.mocked(mockAiTaskRepository.save).mock
        .calls[0][0] as AiTask;
      expect(savedTask.taskType.value).toBe("small_review");
      const payload = savedTask.payload as unknown as ReviewTaskPayload;
      expect(payload.reviewType).toBe("small");
    });
  });

  describe("RuntimeContext検証", () => {
    it("useCachedDocuments=trueが設定されること", async () => {
      // Arrange
      const testResults = createTestReviewResults([1]);
      vi.mocked(
        mockReviewResultRepository.findByReviewTargetId,
      ).mockResolvedValue(testResults);
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        createQueuedReviewTarget(),
      );
      // ドキュメントキャッシュのモックを明示的に再設定
      vi.mocked(
        mockReviewDocumentCacheRepository.findByReviewTargetId,
      ).mockResolvedValue(createTestDocumentCaches());

      let capturedRuntimeContext: RuntimeContext | null = null;
      // cacheCheckStepで使用されるRuntimeContextを通してエージェントでもキャプチャ
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
      const failedItem = { id: "retry-0", content: "チェック項目2の内容" };
      const taskDto = createTestRetryTaskDto([failedItem], "small", [
        testResultId2,
      ]);
      await executor.execute(taskDto);

      // Assert: useCachedDocuments=trueが設定されていることを間接的に検証
      // （エージェントのruntimeContextはworkflowのruntimeContextとは異なるため、
      //   workflow.startで設定されるuseCachedDocumentsの直接検証はAiTaskExecutor単体テストで実施済み）
      // キャッシュモードが有効なため、fileProcessingStepがスキップされること
      expect(mockFileProcessingStep).not.toHaveBeenCalled();
      // レビュー処理が成功していること（キャッシュからドキュメントが読み込まれた）
      expect(capturedRuntimeContext).not.toBeNull();
    });

    it("cachedDocumentsにキャッシュ済みドキュメントが設定されること", async () => {
      // Arrange
      const testResults = createTestReviewResults([1]);
      vi.mocked(
        mockReviewResultRepository.findByReviewTargetId,
      ).mockResolvedValue(testResults);
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        createQueuedReviewTarget(),
      );
      // ドキュメントキャッシュのモックを明示的に再設定
      vi.mocked(
        mockReviewDocumentCacheRepository.findByReviewTargetId,
      ).mockResolvedValue(createTestDocumentCaches());

      // Act
      const failedItem = { id: "retry-0", content: "チェック項目2の内容" };
      const taskDto = createTestRetryTaskDto([failedItem], "small", [
        testResultId2,
      ]);
      const result = await executor.execute(taskDto);

      // Assert: リトライが成功したことで、キャッシュからドキュメントが読み込まれたことを確認
      expect(result.success).toBe(true);
      // ReviewCacheHelperのloadTextCacheまたはloadImageCacheが呼び出されること
      const { ReviewCacheHelper } =
        await import("@/lib/server/reviewCacheHelper");
      expect(ReviewCacheHelper.loadTextCache).toHaveBeenCalled();
    });

    it("FILE_BUFFERS_CONTEXT_KEYは設定されないこと（キャッシュモード）", async () => {
      // Arrange
      const testResults = createTestReviewResults([1]);
      vi.mocked(
        mockReviewResultRepository.findByReviewTargetId,
      ).mockResolvedValue(testResults);
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        createQueuedReviewTarget(),
      );
      // ドキュメントキャッシュのモックを明示的に再設定
      vi.mocked(
        mockReviewDocumentCacheRepository.findByReviewTargetId,
      ).mockResolvedValue(createTestDocumentCaches());

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
      const failedItem = { id: "retry-0", content: "チェック項目2の内容" };
      const taskDto = createTestRetryTaskDto([failedItem], "small", [
        testResultId2,
      ]);
      await executor.execute(taskDto);

      // Assert: キャッシュモードではfileBuffersは設定されない
      // 代わりにcachedDocumentsが使用される
      // fileProcessingStepがスキップされることで間接的に確認
      expect(mockFileProcessingStep).not.toHaveBeenCalled();
      // RuntimeContextにFILE_BUFFERS_CONTEXT_KEYが設定されていないことを確認
      // （リトライモードではfileBuffersは設定されない）
      expect(capturedRuntimeContext).not.toBeNull();
      const fileBuffers = capturedRuntimeContext!.get(FILE_BUFFERS_CONTEXT_KEY);
      expect(fileBuffers).toBeUndefined();
    });
  });

  describe("DB保存検証", () => {
    it("resultsToDeleteIdsのレビュー結果が削除されること", async () => {
      // Arrange
      const testResults = createTestReviewResults([0, 1]); // 2件失敗
      vi.mocked(
        mockReviewResultRepository.findByReviewTargetId,
      ).mockResolvedValue(testResults);
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        createQueuedReviewTarget(),
      );

      // Act
      const failedItems = [
        { id: "retry-0", content: "チェック項目1の内容" },
        { id: "retry-1", content: "チェック項目2の内容" },
      ];
      const taskDto = createTestRetryTaskDto(
        failedItems,
        "small",
        [testResultId1, testResultId2], // 2件削除対象
      );
      await executor.execute(taskDto);

      // Assert: 削除が2回呼ばれることを確認
      expect(mockReviewResultRepository.delete).toHaveBeenCalledTimes(2);
    });

    it("新しいレビュー結果が保存されること", async () => {
      // Arrange
      const testResults = createTestReviewResults([1]);
      vi.mocked(
        mockReviewResultRepository.findByReviewTargetId,
      ).mockResolvedValue(testResults);
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        createQueuedReviewTarget(),
      );

      // Act
      const failedItem = { id: "retry-0", content: "チェック項目2の内容" };
      const taskDto = createTestRetryTaskDto([failedItem], "small", [
        testResultId2,
      ]);
      await executor.execute(taskDto);

      // Assert: saveManyが呼ばれることを確認
      expect(mockReviewResultRepository.saveMany).toHaveBeenCalled();
    });

    it("ドキュメントキャッシュは再保存されないこと（リトライ時）", async () => {
      // Arrange
      const testResults = createTestReviewResults([1]);
      vi.mocked(
        mockReviewResultRepository.findByReviewTargetId,
      ).mockResolvedValue(testResults);
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        createQueuedReviewTarget(),
      );

      // Act
      const failedItem = { id: "retry-0", content: "チェック項目2の内容" };
      const taskDto = createTestRetryTaskDto([failedItem], "small", [
        testResultId2,
      ]);
      await executor.execute(taskDto);

      // Assert: ドキュメントキャッシュの保存は呼ばれないことを確認
      expect(mockReviewDocumentCacheRepository.save).not.toHaveBeenCalled();
    });
  });

  describe("異常系", () => {
    describe("キャッシュ未存在エラー", () => {
      it("ドキュメントキャッシュが存在しない場合にエラーになること", async () => {
        // Arrange: キャッシュなし
        vi.mocked(
          mockReviewDocumentCacheRepository.findByReviewTargetId,
        ).mockResolvedValue([]);
        vi.mocked(
          mockReviewResultRepository.findByReviewTargetId,
        ).mockResolvedValue(createTestReviewResults([1]));
        vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
          createCompletedReviewTarget(),
        );

        // Act & Assert
        const command: RetryReviewCommand = {
          reviewTargetId: testReviewTargetId,
          userId: testUserId,
          retryScope: "failed",
        };

        await expect(retryService.execute(command)).rejects.toMatchObject({
          messageCode: "RETRY_NO_CACHE",
        });
      });
    });

    describe("ワークフロー失敗時", () => {
      it("AIエージェントエラー時にレビュー対象がerror状態になること", async () => {
        // Arrange
        const testResults = createTestReviewResults([1]);
        vi.mocked(
          mockReviewResultRepository.findByReviewTargetId,
        ).mockResolvedValue(testResults);
        vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
          createQueuedReviewTarget(),
        );

        // エージェントをエラーにする
        mockReviewExecuteAgentGenerateLegacy.mockRejectedValue(
          new Error("AI API呼び出しエラー"),
        );

        // Act
        const failedItem = { id: "retry-0", content: "チェック項目2の内容" };
        const taskDto = createTestRetryTaskDto([failedItem], "small", [
          testResultId2,
        ]);
        const result = await executor.execute(taskDto);

        // Assert
        expect(result.success).toBe(false);

        // ReviewTargetがエラー状態で保存されることを確認
        const saveCallArgs = vi.mocked(mockReviewTargetRepository.save).mock
          .calls;
        const lastSaveCall = saveCallArgs[saveCallArgs.length - 1];
        const savedTarget = lastSaveCall[0] as ReviewTarget;
        expect(savedTarget.status.value).toBe("error");
      });
    });
  });
});
