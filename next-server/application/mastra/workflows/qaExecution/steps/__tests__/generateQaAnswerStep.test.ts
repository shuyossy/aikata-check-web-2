import { describe, it, expect, vi, beforeEach } from "vitest";
import { RuntimeContext } from "@mastra/core/di";
import { generateQaAnswerStep } from "../generateQaAnswerStep";
import type { ChecklistResultWithIndividual, ResearchResult, QaExecutionWorkflowRuntimeContext } from "../../types";
import type { IEventBroker } from "@/application/shared/port/push/IEventBroker";

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

describe("generateQaAnswerStep", () => {
  // テストデータ
  const testQuestion = "このドキュメントの安全性についてどのように評価されましたか？";

  const testChecklistResults: ChecklistResultWithIndividual[] = [
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

  const testResearchResults: ResearchResult[] = [
    {
      documentCacheId: "cache-doc-1",
      documentName: "セキュリティガイドライン.docx",
      researchContent: "セキュリティに関する記述を調査",
      researchResult: "第3章にセキュリティに関する記述があり、AES-256暗号化を推奨しています。",
    },
    {
      documentCacheId: "cache-doc-2",
      documentName: "テスト計画書.xlsx",
      researchContent: "セキュリティテスト項目を調査",
      researchResult: "セキュリティテストとして侵入テストが計画されています。",
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

  // イベントブローカーモック
  const createEventBrokerMock = (): IEventBroker => ({
    subscribe: vi.fn(),
    subscribeChannel: vi.fn(),
    unsubscribe: vi.fn(),
    publish: vi.fn(),
    broadcast: vi.fn(),
    unsubscribeAll: vi.fn(),
  });

  // RuntimeContextを作成するヘルパー関数
  const createTestRuntimeContext = (
    options: {
      eventBroker?: IEventBroker;
      userId?: string;
      qaHistoryId?: string;
    } = {}
  ) => {
    const runtimeContext = new RuntimeContext<QaExecutionWorkflowRuntimeContext>();
    if (options.eventBroker) {
      runtimeContext.set("eventBroker", options.eventBroker);
    }
    if (options.userId) {
      runtimeContext.set("userId", options.userId);
    }
    if (options.qaHistoryId) {
      runtimeContext.set("qaHistoryId", options.qaHistoryId);
    }
    return runtimeContext;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系", () => {
    it("調査結果を統合して回答を生成する", async () => {
      // Arrange
      const expectedAnswer = "セキュリティガイドラインの第3章によると、AES-256暗号化が推奨されています。また、テスト計画書では侵入テストが計画されており、セキュリティ対策は概ね適切に行われています。";
      mockGenerateLegacy.mockResolvedValue({
        text: expectedAnswer,
      });

      // Act
      const result = await generateQaAnswerStep.execute({
        inputData: {
          question: testQuestion,
          checklistResults: testChecklistResults,
          researchResults: testResearchResults,
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
      expect(result.answer).toBe(expectedAnswer);
      expect(result.researchSummary).toEqual(testResearchResults);
    });

    it("qaAnswerAgentが呼び出される", async () => {
      // Arrange
      mockGenerateLegacy.mockResolvedValue({
        text: "回答テキスト",
      });

      // Act
      await generateQaAnswerStep.execute({
        inputData: {
          question: testQuestion,
          checklistResults: testChecklistResults,
          researchResults: testResearchResults,
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
      expect(mockGetAgent).toHaveBeenCalledWith("qaAnswerAgent");
      expect(mockGenerateLegacy).toHaveBeenCalled();
    });

    it("RuntimeContextにユーザー質問とチェックリスト情報が含まれる", async () => {
      // Arrange
      mockGenerateLegacy.mockResolvedValue({
        text: "回答テキスト",
      });

      // Act
      await generateQaAnswerStep.execute({
        inputData: {
          question: testQuestion,
          checklistResults: testChecklistResults,
          researchResults: testResearchResults,
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
      expect(options.runtimeContext.get("userQuestion")).toBe(testQuestion);
      expect(options.runtimeContext.get("reviewMode")).toBe("small");
      // checklistInfoは文字列として生成される
      expect(typeof options.runtimeContext.get("checklistInfo")).toBe("string");
    });

    it("プロンプトに調査結果が含まれる", async () => {
      // Arrange
      mockGenerateLegacy.mockResolvedValue({
        text: "回答テキスト",
      });

      // Act
      await generateQaAnswerStep.execute({
        inputData: {
          question: testQuestion,
          checklistResults: testChecklistResults,
          researchResults: testResearchResults,
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
      const promptText = callArgs[0];
      expect(promptText).toContain(testQuestion);
      expect(promptText).toContain("セキュリティガイドライン.docx");
      expect(promptText).toContain("AES-256");
    });
  });

  describe("SSEストリーミング", () => {
    it("eventBrokerが設定されている場合、onStepFinishでSSEイベントが発行される", async () => {
      // Arrange
      const eventBroker = createEventBrokerMock();
      const testUserId = "user-123";
      const testQaHistoryId = "qa-history-456";

      // onStepFinishコールバックをシミュレート
      mockGenerateLegacy.mockImplementation(async (prompt, options) => {
        // onStepFinishを呼び出す
        if (options.onStepFinish) {
          options.onStepFinish({ text: "チャンク1" });
          options.onStepFinish({ text: "チャンク2" });
        }
        return { text: "完全な回答" };
      });

      const runtimeContext = createTestRuntimeContext({
        eventBroker,
        userId: testUserId,
        qaHistoryId: testQaHistoryId,
      });

      // Act
      await generateQaAnswerStep.execute({
        inputData: {
          question: testQuestion,
          checklistResults: testChecklistResults,
          researchResults: testResearchResults,
        },
        mastra: createMastraMock() as any,
        runtimeContext,
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: createBailMock(),
      } as any);

      // Assert
      expect(eventBroker.publish).toHaveBeenCalledWith(
        testUserId,
        `qa:${testQaHistoryId}`,
        expect.objectContaining({
          type: "answer_chunk",
          data: expect.objectContaining({ text: "チャンク1" }),
        })
      );
      expect(eventBroker.publish).toHaveBeenCalledWith(
        testUserId,
        `qa:${testQaHistoryId}`,
        expect.objectContaining({
          type: "answer_chunk",
          data: expect.objectContaining({ text: "チャンク2" }),
        })
      );
    });

    it("eventBrokerがない場合でも正常に動作する", async () => {
      // Arrange
      mockGenerateLegacy.mockResolvedValue({
        text: "回答テキスト",
      });

      // Act
      const result = await generateQaAnswerStep.execute({
        inputData: {
          question: testQuestion,
          checklistResults: testChecklistResults,
          researchResults: testResearchResults,
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
      expect(result.answer).toBe("回答テキスト");
    });
  });

  describe("異常系", () => {
    it("エージェントが見つからない場合エラーを返す", async () => {
      // Arrange
      mockGetAgent.mockReturnValue(null);

      const bailMock = createBailMock();

      // Act
      await generateQaAnswerStep.execute({
        inputData: {
          question: testQuestion,
          checklistResults: testChecklistResults,
          researchResults: testResearchResults,
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
      // エラーがnormalizeUnknownErrorで変換されるため、status: "failed"のみを検証
      expect(bailMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "failed",
        })
      );
    });

    it("AI APIエラー時はbailが呼ばれる", async () => {
      // Arrange
      mockGenerateLegacy.mockRejectedValue(new Error("API呼び出しエラー"));

      const bailMock = createBailMock();

      // Act
      await generateQaAnswerStep.execute({
        inputData: {
          question: testQuestion,
          checklistResults: testChecklistResults,
          researchResults: testResearchResults,
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
        })
      );
    });
  });

  describe("レビューモード判定", () => {
    it("individualResultsがない場合smallモードになる", async () => {
      // Arrange
      mockGenerateLegacy.mockResolvedValue({
        text: "回答",
      });

      const smallChecklistResults: ChecklistResultWithIndividual[] = [
        {
          checklistResult: {
            id: "check-1",
            content: "項目1",
            evaluation: "A",
            comment: "良好",
          },
          individualResults: undefined,
        },
      ];

      // Act
      await generateQaAnswerStep.execute({
        inputData: {
          question: testQuestion,
          checklistResults: smallChecklistResults,
          researchResults: testResearchResults,
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
      expect(options.runtimeContext.get("reviewMode")).toBe("small");
    });

    it("individualResultsがある場合largeモードになる", async () => {
      // Arrange
      mockGenerateLegacy.mockResolvedValue({
        text: "回答",
      });

      const largeChecklistResults: ChecklistResultWithIndividual[] = [
        {
          checklistResult: {
            id: "check-1",
            content: "項目1",
            evaluation: "A",
            comment: "良好",
          },
          individualResults: [
            {
              documentId: "doc-1",
              individualFileName: "part1.docx",
              comment: "コメント",
            },
          ],
        },
      ];

      // Act
      await generateQaAnswerStep.execute({
        inputData: {
          question: testQuestion,
          checklistResults: largeChecklistResults,
          researchResults: testResearchResults,
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
  });
});
