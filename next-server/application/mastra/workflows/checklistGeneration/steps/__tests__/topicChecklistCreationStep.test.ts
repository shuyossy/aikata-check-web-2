import { describe, it, expect, vi, beforeEach } from "vitest";
import { RuntimeContext } from "@mastra/core/di";
import { topicChecklistCreationStep } from "../topicChecklistCreationStep";
import type { ExtractedFile } from "../../../shared/types";
import type { Topic } from "../../types";

// エージェントのモック
const mockGenerateLegacy = vi.fn();

vi.mock("../../../../agents", () => ({
  topicChecklistAgent: {
    generateLegacy: (...args: unknown[]) => mockGenerateLegacy(...args),
  },
  topicChecklistOutputSchema: {
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

describe("topicChecklistCreationStep", () => {
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

  const testTopic: Topic = {
    title: "セキュリティ対策",
    reason: "セキュリティは重要",
  };

  const testChecklistRequirements = "セキュリティに関するチェックリストを作成";

  // RuntimeContextを作成するヘルパー関数
  const createTestRuntimeContext = () => {
    const runtimeContext = new RuntimeContext();
    runtimeContext.set("employeeId", "test-user-id");
    runtimeContext.set("projectApiKey", "test-api-key");
    return runtimeContext;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系", () => {
    it("チェックリスト項目を正常に生成する", async () => {
      // Arrange
      mockGenerateLegacy.mockResolvedValue({
        object: {
          checklistItems: ["チェック項目1", "チェック項目2", "チェック項目3"],
        },
      });

      // Act
      const result = await topicChecklistCreationStep.execute({
        inputData: {
          topic: testTopic,
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
      expect(result.checklistItems).toHaveLength(3);
      expect(result.checklistItems).toContain("チェック項目1");
      expect(result.checklistItems).toContain("チェック項目2");
      expect(result.checklistItems).toContain("チェック項目3");
      expect(result.topicTitle).toBe("セキュリティ対策");
    });

    it("トピック情報がRuntimeContextに設定される", async () => {
      // Arrange
      mockGenerateLegacy.mockResolvedValue({
        object: {
          checklistItems: ["チェック項目1"],
        },
      });

      // Act
      await topicChecklistCreationStep.execute({
        inputData: {
          topic: testTopic,
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
      expect(options.runtimeContext.get("topic")).toEqual(testTopic);
      expect(options.runtimeContext.get("checklistRequirements")).toBe(
        testChecklistRequirements
      );
    });

    it("employeeIdとprojectApiKeyがRuntimeContextから継承される", async () => {
      // Arrange
      mockGenerateLegacy.mockResolvedValue({
        object: {
          checklistItems: ["チェック項目1"],
        },
      });

      // Act
      await topicChecklistCreationStep.execute({
        inputData: {
          topic: testTopic,
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
      expect(options.runtimeContext.get("employeeId")).toBe("test-user-id");
      expect(options.runtimeContext.get("projectApiKey")).toBe("test-api-key");
    });

    it("メッセージにトピック情報が含まれる", async () => {
      // Arrange
      mockGenerateLegacy.mockResolvedValue({
        object: {
          checklistItems: ["チェック項目1"],
        },
      });

      // Act
      await topicChecklistCreationStep.execute({
        inputData: {
          topic: testTopic,
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
      // メッセージの最初のテキストにトピック情報が含まれる
      const textContent = message.content.find(
        (c: { type: string }) => c.type === "text"
      );
      expect(textContent.text).toContain(testTopic.title);
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
          checklistItems: ["画像からのチェック項目"],
        },
      });

      // Act
      const result = await topicChecklistCreationStep.execute({
        inputData: {
          topic: testTopic,
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
      expect(result.checklistItems![0]).toBe("画像からのチェック項目");

      // メッセージに画像が含まれていることを確認
      const callArgs = mockGenerateLegacy.mock.calls[0];
      const message = callArgs[0];
      expect(message.content).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "image",
          }),
        ])
      );
    });

    it("checklistRequirementsがoptionalの場合も正常に動作する", async () => {
      // Arrange
      mockGenerateLegacy.mockResolvedValue({
        object: {
          checklistItems: ["チェック項目1"],
        },
      });

      // Act
      const result = await topicChecklistCreationStep.execute({
        inputData: {
          topic: testTopic,
          files: testFiles,
          // checklistRequirements を省略
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
      expect(result.checklistItems).toHaveLength(1);
    });
  });

  describe("異常系", () => {
    it("チェックリスト項目が生成されなかった場合failedを返す", async () => {
      // Arrange
      mockGenerateLegacy.mockResolvedValue({
        object: {
          checklistItems: [],
        },
      });

      // Act
      const result = await topicChecklistCreationStep.execute({
        inputData: {
          topic: testTopic,
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
      expect(result.errorMessage).toContain(testTopic.title);
      expect(result.errorMessage).toContain("生成できませんでした");
    });

    it("checklistItemsがundefinedの場合failedを返す", async () => {
      // Arrange
      mockGenerateLegacy.mockResolvedValue({
        object: {
          checklistItems: undefined,
        },
      });

      // Act
      const result = await topicChecklistCreationStep.execute({
        inputData: {
          topic: testTopic,
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
      expect(result.errorMessage).toContain(testTopic.title);
    });

    it("outputがundefinedの場合failedを返す", async () => {
      // Arrange
      mockGenerateLegacy.mockResolvedValue({
        object: undefined,
      });

      // Act
      const result = await topicChecklistCreationStep.execute({
        inputData: {
          topic: testTopic,
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
      expect(result.errorMessage).toContain(testTopic.title);
    });

    it("AI APIエラー時はnormalizeUnknownErrorで処理される", async () => {
      // Arrange
      mockGenerateLegacy.mockRejectedValue(new Error("API呼び出しエラー"));

      // Act
      const result = await topicChecklistCreationStep.execute({
        inputData: {
          topic: testTopic,
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
          checklistItems: ["チェック項目1"],
        },
      });

      // Act
      const result = await topicChecklistCreationStep.execute({
        inputData: {
          topic: testTopic,
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
      // employeeIdとprojectApiKeyはundefinedになる
      const callArgs = mockGenerateLegacy.mock.calls[0];
      const options = callArgs[1];
      expect(options.runtimeContext.get("employeeId")).toBeUndefined();
      expect(options.runtimeContext.get("projectApiKey")).toBeUndefined();
    });
  });
});
