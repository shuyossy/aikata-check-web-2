import { describe, it, expect, vi, beforeEach } from "vitest";
import { researchChunkStep } from "../researchChunkStep";
import type { ChecklistResultWithIndividual } from "../../types";

// エージェントをモック
const mockGenerateLegacy = vi.fn();
const mockGetAgent = vi.fn();

// loggerをモック
vi.mock("@/lib/server/logger", () => ({
  getLogger: vi.fn().mockReturnValue({
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}));

// judgeErrorIsContentLengthErrorをモック
vi.mock("@/application/mastra/lib/util", () => ({
  judgeErrorIsContentLengthError: vi.fn().mockReturnValue(false),
}));

describe("researchChunkStep", () => {
  // テストデータ
  const testQuestion = "このドキュメントの安全性についてどのように評価されましたか？";
  const testFileName = "セキュリティガイドライン.docx";
  const testResearchContent = "セキュリティに関する記述を調査";
  const testReasoning = "セキュリティ評価に関する質問のため";

  const testChecklistResultsSmall: ChecklistResultWithIndividual[] = [
    {
      checklistResult: {
        id: "check-1",
        content: "セキュリティ対策が適切に記載されているか",
        evaluation: "B",
        comment: "一部不足がある",
      },
      individualResults: undefined,
    },
  ];

  const testChecklistResultsLarge: ChecklistResultWithIndividual[] = [
    {
      checklistResult: {
        id: "check-1",
        content: "セキュリティ対策が適切に記載されているか",
        evaluation: "B",
        comment: "総合的に不足がある",
      },
      individualResults: [
        {
          documentId: "doc-1",
          individualFileName: "セキュリティガイドライン_part1.docx",
          comment: "Part1ではセキュリティ記述あり",
        },
      ],
    },
  ];

  // bailモック関数
  const createBailMock = () => {
    return vi.fn((result) => result);
  };

  // mastraモックを作成するヘルパー関数
  const createMastraMock = () => {
    mockGetAgent.mockReturnValue({
      generateLegacy: mockGenerateLegacy,
    });
    return {
      getAgent: mockGetAgent,
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系", () => {
    it("テキストチャンク調査が正常に完了する", async () => {
      // Arrange
      const expectedResult = "セキュリティガイドラインの第3章にAES-256暗号化に関する記述があります。";
      mockGenerateLegacy.mockResolvedValue({
        text: expectedResult,
      });

      // Act
      const result = await researchChunkStep.execute({
        inputData: {
          documentCacheId: "cache-doc-1",
          fileName: testFileName,
          researchContent: testResearchContent,
          reasoning: testReasoning,
          chunkContent: {
            text: "これはテストドキュメントのテキストコンテンツです。",
          },
          chunkIndex: 0,
          totalChunks: 1,
          question: testQuestion,
          checklistResults: testChecklistResultsSmall,
        },
        mastra: createMastraMock() as any,
        runtimeContext: undefined,
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: createBailMock(),
      } as any);

      // Assert
      expect(result.status).toBe("success");
      expect(result.chunkResult).toBe(expectedResult);
      expect(result.chunkIndex).toBe(0);
      expect(result.finishReason).toBe("success");
    });

    it("画像チャンク調査が正常に完了する", async () => {
      // Arrange
      const expectedResult = "画像を分析した結果、セキュリティに関する図表が含まれています。";
      mockGenerateLegacy.mockResolvedValue({
        text: expectedResult,
      });

      // Act
      const result = await researchChunkStep.execute({
        inputData: {
          documentCacheId: "cache-doc-1",
          fileName: testFileName,
          researchContent: testResearchContent,
          reasoning: testReasoning,
          chunkContent: {
            images: ["base64-encoded-image-1", "base64-encoded-image-2"],
          },
          chunkIndex: 1,
          totalChunks: 3,
          question: testQuestion,
          checklistResults: testChecklistResultsSmall,
        },
        mastra: createMastraMock() as any,
        runtimeContext: undefined,
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: createBailMock(),
      } as any);

      // Assert
      expect(result.status).toBe("success");
      expect(result.chunkResult).toBe(expectedResult);
      expect(result.chunkIndex).toBe(1);
      expect(result.finishReason).toBe("success");
    });

    it("qaResearchAgentが呼び出される", async () => {
      // Arrange
      mockGenerateLegacy.mockResolvedValue({
        text: "調査結果テキスト",
      });

      // Act
      await researchChunkStep.execute({
        inputData: {
          documentCacheId: "cache-doc-1",
          fileName: testFileName,
          researchContent: testResearchContent,
          reasoning: testReasoning,
          chunkContent: {
            text: "テストコンテンツ",
          },
          chunkIndex: 0,
          totalChunks: 1,
          question: testQuestion,
          checklistResults: testChecklistResultsSmall,
        },
        mastra: createMastraMock() as any,
        runtimeContext: undefined,
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: createBailMock(),
      } as any);

      // Assert
      expect(mockGetAgent).toHaveBeenCalledWith("qaResearchAgent");
      expect(mockGenerateLegacy).toHaveBeenCalled();
    });

    it("RuntimeContextに正しい値が設定される", async () => {
      // Arrange
      mockGenerateLegacy.mockResolvedValue({
        text: "調査結果テキスト",
      });

      // Act
      await researchChunkStep.execute({
        inputData: {
          documentCacheId: "cache-doc-1",
          fileName: testFileName,
          researchContent: testResearchContent,
          reasoning: testReasoning,
          chunkContent: {
            text: "テストコンテンツ",
          },
          chunkIndex: 2,
          totalChunks: 5,
          question: testQuestion,
          checklistResults: testChecklistResultsSmall,
        },
        mastra: createMastraMock() as any,
        runtimeContext: undefined,
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: createBailMock(),
      } as any);

      // Assert
      const callArgs = mockGenerateLegacy.mock.calls[0];
      const options = callArgs[1];
      expect(options.runtimeContext.get("researchContent")).toBe(testResearchContent);
      expect(options.runtimeContext.get("totalChunks")).toBe(5);
      expect(options.runtimeContext.get("chunkIndex")).toBe(2);
      expect(options.runtimeContext.get("fileName")).toBe(testFileName);
      expect(options.runtimeContext.get("userQuestion")).toBe(testQuestion);
      expect(options.runtimeContext.get("reviewMode")).toBe("small");
    });

    it("大量レビューモードの場合reviewModeがlargeになる", async () => {
      // Arrange
      mockGenerateLegacy.mockResolvedValue({
        text: "調査結果テキスト",
      });

      // Act
      await researchChunkStep.execute({
        inputData: {
          documentCacheId: "cache-doc-1",
          fileName: testFileName,
          researchContent: testResearchContent,
          reasoning: testReasoning,
          chunkContent: {
            text: "テストコンテンツ",
          },
          chunkIndex: 0,
          totalChunks: 1,
          question: testQuestion,
          checklistResults: testChecklistResultsLarge,
        },
        mastra: createMastraMock() as any,
        runtimeContext: undefined,
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: createBailMock(),
      } as any);

      // Assert
      const callArgs = mockGenerateLegacy.mock.calls[0];
      const options = callArgs[1];
      expect(options.runtimeContext.get("reviewMode")).toBe("large");
    });

    it("プロンプトにドキュメント名と調査内容が含まれる", async () => {
      // Arrange
      mockGenerateLegacy.mockResolvedValue({
        text: "調査結果テキスト",
      });

      // Act
      await researchChunkStep.execute({
        inputData: {
          documentCacheId: "cache-doc-1",
          fileName: testFileName,
          researchContent: testResearchContent,
          reasoning: testReasoning,
          chunkContent: {
            text: "テストコンテンツ",
          },
          chunkIndex: 0,
          totalChunks: 1,
          question: testQuestion,
          checklistResults: testChecklistResultsSmall,
        },
        mastra: createMastraMock() as any,
        runtimeContext: undefined,
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: createBailMock(),
      } as any);

      // Assert
      const callArgs = mockGenerateLegacy.mock.calls[0];
      const message = callArgs[0];
      expect(message.content[0].text).toContain(testFileName);
      expect(message.content[0].text).toContain(testResearchContent);
      expect(message.content[0].text).toContain("テストコンテンツ");
    });
  });

  describe("異常系", () => {
    it("チャンク内容がない場合bailが呼ばれる", async () => {
      // Arrange
      const bailMock = createBailMock();

      // Act
      await researchChunkStep.execute({
        inputData: {
          documentCacheId: "cache-doc-1",
          fileName: testFileName,
          researchContent: testResearchContent,
          reasoning: testReasoning,
          chunkContent: {},
          chunkIndex: 0,
          totalChunks: 1,
          question: testQuestion,
          checklistResults: testChecklistResultsSmall,
        },
        mastra: createMastraMock() as any,
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
          errorMessage: "チャンクのコンテンツが見つかりませんでした",
          finishReason: "error",
        })
      );
    });

    it("エージェントが見つからない場合エラーを返す", async () => {
      // Arrange
      mockGetAgent.mockReturnValue(null);
      const bailMock = createBailMock();

      // Act
      await researchChunkStep.execute({
        inputData: {
          documentCacheId: "cache-doc-1",
          fileName: testFileName,
          researchContent: testResearchContent,
          reasoning: testReasoning,
          chunkContent: {
            text: "テストコンテンツ",
          },
          chunkIndex: 0,
          totalChunks: 1,
          question: testQuestion,
          checklistResults: testChecklistResultsSmall,
        },
        mastra: {
          getAgent: mockGetAgent,
        } as any,
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
          finishReason: "error",
        })
      );
    });

    it("AI APIエラー時はbailが呼ばれる", async () => {
      // Arrange
      mockGenerateLegacy.mockRejectedValue(new Error("API呼び出しエラー"));
      const bailMock = createBailMock();

      // Act
      await researchChunkStep.execute({
        inputData: {
          documentCacheId: "cache-doc-1",
          fileName: testFileName,
          researchContent: testResearchContent,
          reasoning: testReasoning,
          chunkContent: {
            text: "テストコンテンツ",
          },
          chunkIndex: 0,
          totalChunks: 1,
          question: testQuestion,
          checklistResults: testChecklistResultsSmall,
        },
        mastra: createMastraMock() as any,
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
          finishReason: "error",
        })
      );
    });

    it("コンテキスト長エラー時はfinishReason='content_length'で成功を返す", async () => {
      // Arrange
      const { judgeErrorIsContentLengthError } = await import("@/application/mastra/lib/util");
      vi.mocked(judgeErrorIsContentLengthError).mockReturnValue(true);
      mockGenerateLegacy.mockRejectedValue(new Error("context_length_exceeded"));

      // Act
      const result = await researchChunkStep.execute({
        inputData: {
          documentCacheId: "cache-doc-1",
          fileName: testFileName,
          researchContent: testResearchContent,
          reasoning: testReasoning,
          chunkContent: {
            text: "非常に長いテキストコンテンツ...",
          },
          chunkIndex: 0,
          totalChunks: 1,
          question: testQuestion,
          checklistResults: testChecklistResultsSmall,
        },
        mastra: createMastraMock() as any,
        runtimeContext: undefined,
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: createBailMock(),
      } as any);

      // Assert
      expect(result.status).toBe("success");
      expect(result.finishReason).toBe("content_length");
      expect(result.chunkIndex).toBe(0);
    });

    it("空の画像配列の場合bailが呼ばれる", async () => {
      // Arrange
      const bailMock = createBailMock();

      // Act
      await researchChunkStep.execute({
        inputData: {
          documentCacheId: "cache-doc-1",
          fileName: testFileName,
          researchContent: testResearchContent,
          reasoning: testReasoning,
          chunkContent: {
            images: [],
          },
          chunkIndex: 0,
          totalChunks: 1,
          question: testQuestion,
          checklistResults: testChecklistResultsSmall,
        },
        mastra: createMastraMock() as any,
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
          errorMessage: "チャンクのコンテンツが見つかりませんでした",
        })
      );
    });
  });
});
