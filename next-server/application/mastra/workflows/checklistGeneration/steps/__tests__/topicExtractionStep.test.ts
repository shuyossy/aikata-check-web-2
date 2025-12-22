import { describe, it, expect, vi, beforeEach } from "vitest";
import { RuntimeContext } from "@mastra/core/di";
import { topicExtractionStep } from "../topicExtractionStep";
import type { ExtractedFile } from "../../../shared/types";

// エージェントのモック
const mockGenerateLegacy = vi.fn();

vi.mock("../../../../agents", () => ({
  topicExtractionAgent: {
    generateLegacy: (...args: unknown[]) => mockGenerateLegacy(...args),
  },
  topicExtractionOutputSchema: {
    parse: vi.fn((v: unknown) => v),
  },
}));

// loggerをモック
vi.mock("@/lib/server/logger", () => ({
  getLogger: vi.fn().mockReturnValue({
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe("topicExtractionStep", () => {
  // テストデータ
  const testFiles: ExtractedFile[] = [
    {
      id: "file-1",
      name: "test-document.txt",
      type: "text/plain",
      processMode: "text",
      textContent: "これはテストドキュメントの内容です。",
    },
  ];

  const testChecklistRequirements = "セキュリティに関するチェックリストを作成";

  // RuntimeContextを作成するヘルパー関数
  const createTestRuntimeContext = () => {
    const runtimeContext = new RuntimeContext();
    runtimeContext.set("employeeId", "test-user-id");
    runtimeContext.set("aiApiKey", "test-api-key");
    return runtimeContext;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系", () => {
    it("トピックを正常に抽出する", async () => {
      // Arrange
      mockGenerateLegacy.mockResolvedValue({
        object: {
          topics: [
            { title: "セキュリティ対策", reason: "セキュリティは重要" },
            { title: "データ保護", reason: "データ保護は必須" },
          ],
        },
      });

      // Act
      const result = await topicExtractionStep.execute({
        inputData: {
          files: testFiles,
          checklistRequirements: testChecklistRequirements,
        },
        runtimeContext: createTestRuntimeContext(),
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: vi.fn(),
      } as any);

      // Assert
      expect(result.status).toBe("success");
      expect(result.topics).toHaveLength(2);
      expect(result.topics![0].title).toBe("セキュリティ対策");
      expect(result.topics![1].title).toBe("データ保護");
      expect(result.checklistRequirements).toBe(testChecklistRequirements);
    });

    it("checklistRequirementsがRuntimeContextに設定される", async () => {
      // Arrange
      mockGenerateLegacy.mockResolvedValue({
        object: {
          topics: [{ title: "トピック1", reason: "理由1" }],
        },
      });

      // Act
      await topicExtractionStep.execute({
        inputData: {
          files: testFiles,
          checklistRequirements: testChecklistRequirements,
        },
        runtimeContext: createTestRuntimeContext(),
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: vi.fn(),
      } as any);

      // Assert
      const callArgs = mockGenerateLegacy.mock.calls[0];
      const options = callArgs[1];
      expect(options.runtimeContext.get("checklistRequirements")).toBe(
        testChecklistRequirements,
      );
    });

    it("employeeIdとaiApiKeyがRuntimeContextから継承される", async () => {
      // Arrange
      mockGenerateLegacy.mockResolvedValue({
        object: {
          topics: [{ title: "トピック1", reason: "理由1" }],
        },
      });

      const runtimeContext = createTestRuntimeContext();

      // Act
      await topicExtractionStep.execute({
        inputData: {
          files: testFiles,
          checklistRequirements: testChecklistRequirements,
        },
        runtimeContext,
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: vi.fn(),
      } as any);

      // Assert
      const callArgs = mockGenerateLegacy.mock.calls[0];
      const options = callArgs[1];
      expect(options.runtimeContext.get("employeeId")).toBe("test-user-id");
      expect(options.runtimeContext.get("aiApiKey")).toBe("test-api-key");
    });

    it("メッセージにファイル内容が含まれる", async () => {
      // Arrange
      mockGenerateLegacy.mockResolvedValue({
        object: {
          topics: [{ title: "トピック1", reason: "理由1" }],
        },
      });

      // Act
      await topicExtractionStep.execute({
        inputData: {
          files: testFiles,
          checklistRequirements: testChecklistRequirements,
        },
        runtimeContext: createTestRuntimeContext(),
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: vi.fn(),
      } as any);

      // Assert
      const callArgs = mockGenerateLegacy.mock.calls[0];
      const message = callArgs[0];
      expect(message.content).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "text",
          }),
        ]),
      );
    });

    it("画像ファイルも正常に処理される", async () => {
      // Arrange
      const imageFiles: ExtractedFile[] = [
        {
          id: "file-1",
          name: "document.pdf",
          type: "application/pdf",
          processMode: "image",
          imageData: ["base64imagedata"],
        },
      ];

      mockGenerateLegacy.mockResolvedValue({
        object: {
          topics: [{ title: "画像からのトピック", reason: "理由" }],
        },
      });

      // Act
      const result = await topicExtractionStep.execute({
        inputData: {
          files: imageFiles,
          checklistRequirements: testChecklistRequirements,
        },
        runtimeContext: createTestRuntimeContext(),
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: vi.fn(),
      } as any);

      // Assert
      expect(result.status).toBe("success");
      expect(result.topics![0].title).toBe("画像からのトピック");

      // メッセージに画像が含まれていることを確認
      const callArgs = mockGenerateLegacy.mock.calls[0];
      const message = callArgs[0];
      expect(message.content).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "image",
          }),
        ]),
      );
    });
  });

  describe("異常系", () => {
    it("トピックが抽出されなかった場合failedを返す", async () => {
      // Arrange
      mockGenerateLegacy.mockResolvedValue({
        object: {
          topics: [],
        },
      });

      // Act
      const result = await topicExtractionStep.execute({
        inputData: {
          files: testFiles,
          checklistRequirements: testChecklistRequirements,
        },
        runtimeContext: createTestRuntimeContext(),
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: vi.fn(),
      } as any);

      // Assert
      expect(result.status).toBe("failed");
      expect(result.errorMessage).toContain("トピックを抽出できませんでした");
    });

    it("topicsがundefinedの場合failedを返す", async () => {
      // Arrange
      mockGenerateLegacy.mockResolvedValue({
        object: {
          topics: undefined,
        },
      });

      // Act
      const result = await topicExtractionStep.execute({
        inputData: {
          files: testFiles,
          checklistRequirements: testChecklistRequirements,
        },
        runtimeContext: createTestRuntimeContext(),
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: vi.fn(),
      } as any);

      // Assert
      expect(result.status).toBe("failed");
      expect(result.errorMessage).toContain("トピックを抽出できませんでした");
    });

    it("outputがundefinedの場合failedを返す", async () => {
      // Arrange
      mockGenerateLegacy.mockResolvedValue({
        object: undefined,
      });

      // Act
      const result = await topicExtractionStep.execute({
        inputData: {
          files: testFiles,
          checklistRequirements: testChecklistRequirements,
        },
        runtimeContext: createTestRuntimeContext(),
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: vi.fn(),
      } as any);

      // Assert
      expect(result.status).toBe("failed");
      expect(result.errorMessage).toContain("トピックを抽出できませんでした");
    });

    it("AI APIエラー時はnormalizeUnknownErrorで処理される", async () => {
      // Arrange
      mockGenerateLegacy.mockRejectedValue(new Error("API呼び出しエラー"));

      // Act
      const result = await topicExtractionStep.execute({
        inputData: {
          files: testFiles,
          checklistRequirements: testChecklistRequirements,
        },
        runtimeContext: createTestRuntimeContext(),
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: vi.fn(),
      } as any);

      // Assert
      expect(result.status).toBe("failed");
      expect(result.errorMessage).toBeDefined();
    });

    it("RuntimeContextがundefinedでも動作する", async () => {
      // Arrange
      mockGenerateLegacy.mockResolvedValue({
        object: {
          topics: [{ title: "トピック1", reason: "理由1" }],
        },
      });

      // Act
      const result = await topicExtractionStep.execute({
        inputData: {
          files: testFiles,
          checklistRequirements: testChecklistRequirements,
        },
        runtimeContext: undefined,
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: vi.fn(),
      } as any);

      // Assert
      expect(result.status).toBe("success");
      // employeeIdとaiApiKeyはundefinedになる
      const callArgs = mockGenerateLegacy.mock.calls[0];
      const options = callArgs[1];
      expect(options.runtimeContext.get("employeeId")).toBeUndefined();
      expect(options.runtimeContext.get("aiApiKey")).toBeUndefined();
    });
  });
});
