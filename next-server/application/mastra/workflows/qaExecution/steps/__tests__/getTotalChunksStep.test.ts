import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTotalChunksStep } from "../getTotalChunksStep";

// LargeDocumentResultCacheRepositoryをモック
const mockGetMaxTotalChunksForDocument = vi.fn();

vi.mock(
  "@/infrastructure/adapter/db/drizzle/repository/LargeDocumentResultCacheRepository",
  () => ({
    LargeDocumentResultCacheRepository: vi.fn().mockImplementation(() => ({
      getMaxTotalChunksForDocument: mockGetMaxTotalChunksForDocument,
    })),
  })
);

// loggerをモック
vi.mock("@/lib/server/logger", () => ({
  getLogger: vi.fn().mockReturnValue({
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe("getTotalChunksStep", () => {
  // テストデータ
  const testDocumentCacheId = "cache-doc-1";
  const testResearchContent = "セキュリティに関する記述を調査";
  const testReasoning = "セキュリティ評価に関する質問のため";

  // bailモック関数
  const createBailMock = () => {
    return vi.fn((result) => result);
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系", () => {
    it("キャッシュが存在する場合、最大チャンク数を返す", async () => {
      // Arrange
      mockGetMaxTotalChunksForDocument.mockResolvedValue(5);

      // Act
      const result = await getTotalChunksStep.execute({
        inputData: {
          documentCacheId: testDocumentCacheId,
          researchContent: testResearchContent,
          reasoning: testReasoning,
        },
        mastra: undefined,
        runtimeContext: undefined,
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: createBailMock(),
      } as any);

      // Assert
      expect(result.status).toBe("success");
      expect(result.totalChunks).toBe(5);
      expect(result.documentCacheId).toBe(testDocumentCacheId);
      expect(result.researchContent).toBe(testResearchContent);
      expect(result.reasoning).toBe(testReasoning);
    });

    it("キャッシュが存在しない場合、1を返す", async () => {
      // Arrange
      mockGetMaxTotalChunksForDocument.mockResolvedValue(1);

      // Act
      const result = await getTotalChunksStep.execute({
        inputData: {
          documentCacheId: testDocumentCacheId,
          researchContent: testResearchContent,
          reasoning: testReasoning,
        },
        mastra: undefined,
        runtimeContext: undefined,
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: createBailMock(),
      } as any);

      // Assert
      expect(result.status).toBe("success");
      expect(result.totalChunks).toBe(1);
    });

    it("リポジトリのgetMaxTotalChunksForDocumentが正しい引数で呼び出される", async () => {
      // Arrange
      mockGetMaxTotalChunksForDocument.mockResolvedValue(3);

      // Act
      await getTotalChunksStep.execute({
        inputData: {
          documentCacheId: testDocumentCacheId,
          researchContent: testResearchContent,
          reasoning: testReasoning,
        },
        mastra: undefined,
        runtimeContext: undefined,
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: createBailMock(),
      } as any);

      // Assert
      expect(mockGetMaxTotalChunksForDocument).toHaveBeenCalledWith(testDocumentCacheId);
    });

    it("入力データがそのまま出力に含まれる", async () => {
      // Arrange
      mockGetMaxTotalChunksForDocument.mockResolvedValue(2);
      const customResearchContent = "カスタム調査内容";
      const customReasoning = "カスタム理由";

      // Act
      const result = await getTotalChunksStep.execute({
        inputData: {
          documentCacheId: "custom-doc-id",
          researchContent: customResearchContent,
          reasoning: customReasoning,
        },
        mastra: undefined,
        runtimeContext: undefined,
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: createBailMock(),
      } as any);

      // Assert
      expect(result.documentCacheId).toBe("custom-doc-id");
      expect(result.researchContent).toBe(customResearchContent);
      expect(result.reasoning).toBe(customReasoning);
    });
  });

  describe("異常系", () => {
    it("リポジトリアクセスエラー時bailが呼ばれる", async () => {
      // Arrange
      mockGetMaxTotalChunksForDocument.mockRejectedValue(
        new Error("データベース接続エラー")
      );
      const bailMock = createBailMock();

      // Act
      await getTotalChunksStep.execute({
        inputData: {
          documentCacheId: testDocumentCacheId,
          researchContent: testResearchContent,
          reasoning: testReasoning,
        },
        mastra: undefined,
        runtimeContext: undefined,
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: bailMock,
      } as any);

      // Assert
      expect(bailMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "failed",
        })
      );
    });

    it("不明なエラー時もbailが呼ばれる", async () => {
      // Arrange
      mockGetMaxTotalChunksForDocument.mockRejectedValue("unknown error");
      const bailMock = createBailMock();

      // Act
      await getTotalChunksStep.execute({
        inputData: {
          documentCacheId: testDocumentCacheId,
          researchContent: testResearchContent,
          reasoning: testReasoning,
        },
        mastra: undefined,
        runtimeContext: undefined,
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: bailMock,
      } as any);

      // Assert
      expect(bailMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "failed",
        })
      );
    });
  });
});
