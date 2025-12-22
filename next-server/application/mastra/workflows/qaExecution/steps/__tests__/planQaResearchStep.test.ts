import { describe, it, expect, vi, beforeEach } from "vitest";
import { planQaResearchStep } from "../planQaResearchStep";
import type {
  AvailableDocument,
  ChecklistResultWithIndividual,
} from "../../types";

// エージェントをモック
const mockGenerateLegacy = vi.fn();
const mockGetAgent = vi.fn();

vi.mock("@mastra/core/workflows", async () => {
  const actual = await vi.importActual("@mastra/core/workflows");
  return {
    ...actual,
  };
});

// loggerをモック
vi.mock("@/lib/server/logger", () => ({
  getLogger: vi.fn().mockReturnValue({
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe("planQaResearchStep", () => {
  // テストデータ
  const testQuestion =
    "このドキュメントの安全性についてどのように評価されましたか？";

  const testAvailableDocuments: AvailableDocument[] = [
    { id: "doc-1", fileName: "セキュリティガイドライン.docx" },
    { id: "doc-2", fileName: "テスト計画書.xlsx" },
  ];

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
        {
          documentId: "doc-1",
          individualFileName: "セキュリティガイドライン_part2.docx",
          comment: "Part2ではセキュリティ記述なし",
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
    it("調査計画を正常に作成する（少量レビューモード）", async () => {
      // Arrange
      mockGenerateLegacy.mockResolvedValue({
        object: {
          tasks: [
            {
              reasoning: "セキュリティ評価に関する質問のため",
              documentId: "doc-1",
              researchContent: "セキュリティに関する記述を調査",
            },
          ],
        },
      });

      // Act
      const result = await planQaResearchStep.execute({
        inputData: {
          question: testQuestion,
          availableDocuments: testAvailableDocuments,
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
      expect(result.researchTasks).toHaveLength(1);
      expect(result.researchTasks![0].documentCacheId).toBe("doc-1");
      expect(result.researchTasks![0].researchContent).toBe(
        "セキュリティに関する記述を調査",
      );
      expect(result.researchTasks![0].reasoning).toBe(
        "セキュリティ評価に関する質問のため",
      );
    });

    it("調査計画を正常に作成する（大量レビューモード）", async () => {
      // Arrange
      mockGenerateLegacy.mockResolvedValue({
        object: {
          tasks: [
            {
              reasoning: "個別レビュー結果でPart2に問題があるため",
              documentId: "doc-1",
              researchContent: "Part2のセキュリティ記述を詳細調査",
            },
          ],
        },
      });

      // Act
      const result = await planQaResearchStep.execute({
        inputData: {
          question: testQuestion,
          availableDocuments: testAvailableDocuments,
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
      expect(result.status).toBe("success");
      expect(result.researchTasks).toHaveLength(1);
    });

    it("複数のドキュメントを調査対象として選択する", async () => {
      // Arrange
      mockGenerateLegacy.mockResolvedValue({
        object: {
          tasks: [
            {
              reasoning: "セキュリティガイドラインを確認",
              documentId: "doc-1",
              researchContent: "セキュリティ項目の調査",
            },
            {
              reasoning: "テスト計画でのセキュリティテストを確認",
              documentId: "doc-2",
              researchContent: "セキュリティテスト項目の調査",
            },
          ],
        },
      });

      // Act
      const result = await planQaResearchStep.execute({
        inputData: {
          question: testQuestion,
          availableDocuments: testAvailableDocuments,
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
      expect(result.researchTasks).toHaveLength(2);
      expect(result.researchTasks![0].documentCacheId).toBe("doc-1");
      expect(result.researchTasks![1].documentCacheId).toBe("doc-2");
    });

    it("qaPlanningAgentが呼び出される", async () => {
      // Arrange
      mockGenerateLegacy.mockResolvedValue({
        object: {
          tasks: [
            {
              reasoning: "理由",
              documentId: "doc-1",
              researchContent: "調査内容",
            },
          ],
        },
      });

      // Act
      await planQaResearchStep.execute({
        inputData: {
          question: testQuestion,
          availableDocuments: testAvailableDocuments,
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
      expect(mockGetAgent).toHaveBeenCalledWith("qaPlanningAgent");
      expect(mockGenerateLegacy).toHaveBeenCalledWith(
        testQuestion,
        expect.any(Object),
      );
    });
  });

  describe("異常系", () => {
    it("調査対象ドキュメントが特定できなかった場合bailが呼ばれる", async () => {
      // Arrange
      mockGenerateLegacy.mockResolvedValue({
        object: {
          tasks: [],
        },
      });

      const bailMock = createBailMock();

      // Act
      const result = await planQaResearchStep.execute({
        inputData: {
          question: testQuestion,
          availableDocuments: testAvailableDocuments,
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
      expect(bailMock).toHaveBeenCalledWith({
        status: "failed",
        errorMessage: "調査対象のドキュメントが見つかりませんでした。",
      });
    });

    it("tasksがundefinedの場合bailが呼ばれる", async () => {
      // Arrange
      mockGenerateLegacy.mockResolvedValue({
        object: {
          tasks: undefined,
        },
      });

      const bailMock = createBailMock();

      // Act
      await planQaResearchStep.execute({
        inputData: {
          question: testQuestion,
          availableDocuments: testAvailableDocuments,
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
      expect(bailMock).toHaveBeenCalled();
    });

    it("エージェントが見つからない場合エラーを返す", async () => {
      // Arrange
      mockGetAgent.mockReturnValue(null);

      const bailMock = createBailMock();

      // Act
      await planQaResearchStep.execute({
        inputData: {
          question: testQuestion,
          availableDocuments: testAvailableDocuments,
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
      // エラーがnormalizeUnknownErrorで変換されるため、status: "failed"のみを検証
      expect(bailMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "failed",
        }),
      );
    });

    it("AI APIエラー時はbailが呼ばれる", async () => {
      // Arrange
      mockGenerateLegacy.mockRejectedValue(new Error("API呼び出しエラー"));

      const bailMock = createBailMock();

      // Act
      await planQaResearchStep.execute({
        inputData: {
          question: testQuestion,
          availableDocuments: testAvailableDocuments,
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
        }),
      );
    });
  });
});
