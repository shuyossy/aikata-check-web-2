/**
 * チェックリスト生成ワークフローのテスト
 * electron版 (`electron-ver/src/__tests__/main/workflows/checklistExtraction.test.ts`) を参考に作成
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RuntimeContext } from "@mastra/core/di";
import { checklistGenerationWorkflow } from "../index";
import { checkWorkflowResult } from "../../../lib/workflowUtils";
import type { RawUploadFileMeta } from "../../shared";

// vi.hoistedを使ってモック関数をホイスト（vi.mockより先に宣言される）
const { mockTopicExtractionAgentGenerateLegacy, mockTopicChecklistAgentGenerateLegacy, mockFileProcessingStep } = vi.hoisted(() => ({
  mockTopicExtractionAgentGenerateLegacy: vi.fn(),
  mockTopicChecklistAgentGenerateLegacy: vi.fn(),
  mockFileProcessingStep: vi.fn(),
}));

// エージェントのモック設定
vi.mock("../../../agents", () => ({
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
}));

// fileProcessingStepをモック
// workflowテストではfileProcessingStepの内部実装をテストしないため、モックで代替
vi.mock("../../shared", async () => {
  const actual = await vi.importActual<typeof import("../../shared")>("../../shared");
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

describe("checklistGenerationWorkflow", () => {
  // テストデータ: RawUploadFileMeta形式
  const testFiles: RawUploadFileMeta[] = [
    {
      id: "file-1",
      name: "test-document.txt",
      type: "text/plain",
      size: 1000,
      processMode: "text",
    },
  ];

  const testChecklistRequirements = "セキュリティに関するチェックリストを作成";

  // RuntimeContextを作成するヘルパー関数（fileBuffersは不要になった）
  const createTestRuntimeContext = () => {
    const runtimeContext = new RuntimeContext();
    runtimeContext.set("employeeId", "test-user-id");
    runtimeContext.set("projectApiKey", "test-api-key");
    return runtimeContext;
  };

  // fileProcessingStepのデフォルトモック戻り値を設定
  const setupDefaultFileProcessingMock = () => {
    mockFileProcessingStep.mockResolvedValue({
      status: "success",
      extractedFiles: [
        {
          id: "file-1",
          name: "test-document.txt",
          type: "text/plain",
          processMode: "text",
          textContent: "テストドキュメントの内容",
        },
      ],
      checklistRequirements: testChecklistRequirements,
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultFileProcessingMock();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("正常系", () => {
    it("トピック抽出とチェックリスト作成が成功すること", async () => {
      // Arrange
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
          object: {
            checklistItems: ["セキュリティ項目1", "セキュリティ項目2"],
          },
        })
        .mockResolvedValueOnce({
          object: {
            checklistItems: ["データ保護項目1"],
          },
        });

      // Act
      const run = await checklistGenerationWorkflow.createRunAsync();
      const result = await run.start({
        inputData: {
          files: testFiles,
          checklistRequirements: testChecklistRequirements,
        },
        runtimeContext: createTestRuntimeContext(),
      });

      // Assert
      const checkResult = checkWorkflowResult(result);
      expect(checkResult.status).toBe("success");
      expect(mockTopicExtractionAgentGenerateLegacy).toHaveBeenCalledTimes(1);
      expect(mockTopicChecklistAgentGenerateLegacy).toHaveBeenCalledTimes(2);

      // 結果の検証
      if (result.status === "success") {
        const workflowResult = result.result as {
          status: string;
          generatedItems?: string[];
          totalCount?: number;
        };
        expect(workflowResult.status).toBe("success");
        expect(workflowResult.generatedItems).toHaveLength(3);
        expect(workflowResult.generatedItems).toContain("セキュリティ項目1");
        expect(workflowResult.generatedItems).toContain("セキュリティ項目2");
        expect(workflowResult.generatedItems).toContain("データ保護項目1");
        expect(workflowResult.totalCount).toBe(3);
      }
    });

    it("複数トピックに対してチェックリストが作成されること", async () => {
      // Arrange
      mockTopicExtractionAgentGenerateLegacy.mockResolvedValue({
        object: {
          topics: [
            { title: "トピック1", reason: "理由1" },
            { title: "トピック2", reason: "理由2" },
            { title: "トピック3", reason: "理由3" },
          ],
        },
      });

      mockTopicChecklistAgentGenerateLegacy.mockResolvedValue({
        object: {
          checklistItems: ["チェック項目"],
        },
      });

      // Act
      const run = await checklistGenerationWorkflow.createRunAsync();
      const result = await run.start({
        inputData: {
          files: testFiles,
          checklistRequirements: testChecklistRequirements,
        },
        runtimeContext: createTestRuntimeContext(),
      });

      // Assert
      const checkResult = checkWorkflowResult(result);
      expect(checkResult.status).toBe("success");

      // 各トピックに対してチェックリスト作成が実行される
      expect(mockTopicChecklistAgentGenerateLegacy).toHaveBeenCalledTimes(3);
    });

    it("checklistRequirementsがruntimeContextに正しく設定されること", async () => {
      // Arrange
      mockTopicExtractionAgentGenerateLegacy.mockResolvedValue({
        object: {
          topics: [{ title: "トピック1", reason: "理由1" }],
        },
      });

      mockTopicChecklistAgentGenerateLegacy.mockResolvedValue({
        object: {
          checklistItems: ["チェック項目"],
        },
      });

      // Act
      const run = await checklistGenerationWorkflow.createRunAsync();
      await run.start({
        inputData: {
          files: testFiles,
          checklistRequirements: testChecklistRequirements,
        },
        runtimeContext: createTestRuntimeContext(),
      });

      // Assert
      // topicExtractionAgentに渡されたruntimeContextを確認
      const topicExtractionCallArgs =
        mockTopicExtractionAgentGenerateLegacy.mock.calls[0];
      const topicExtractionOptions = topicExtractionCallArgs[1];
      const topicRuntimeContext = topicExtractionOptions.runtimeContext;
      expect(topicRuntimeContext.get("checklistRequirements")).toBe(
        testChecklistRequirements,
      );

      // topicChecklistAgentに渡されたruntimeContextを確認
      const topicChecklistCallArgs =
        mockTopicChecklistAgentGenerateLegacy.mock.calls[0];
      const topicChecklistOptions = topicChecklistCallArgs[1];
      const checklistRuntimeContext = topicChecklistOptions.runtimeContext;
      expect(checklistRuntimeContext.get("checklistRequirements")).toBe(
        testChecklistRequirements,
      );
    });

    it("topicChecklistAgentにfilesが渡されていること", async () => {
      // Arrange
      mockTopicExtractionAgentGenerateLegacy.mockResolvedValue({
        object: {
          topics: [{ title: "セキュリティ対策", reason: "セキュリティは重要" }],
        },
      });

      mockTopicChecklistAgentGenerateLegacy.mockResolvedValue({
        object: {
          checklistItems: ["チェック項目"],
        },
      });

      // Act
      const run = await checklistGenerationWorkflow.createRunAsync();
      await run.start({
        inputData: {
          files: testFiles,
          checklistRequirements: testChecklistRequirements,
        },
        runtimeContext: createTestRuntimeContext(),
      });

      // Assert
      // topicChecklistAgentに渡されたメッセージを確認
      const topicChecklistCallArgs =
        mockTopicChecklistAgentGenerateLegacy.mock.calls[0];
      const message = topicChecklistCallArgs[0];

      // メッセージにドキュメント内容が含まれていることを確認
      // createCombinedMessageによりテキストコンテンツが含まれる
      expect(message.content).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "text",
          }),
        ]),
      );

      // トピック情報が含まれていることを確認
      const textContent = message.content.find(
        (c: { type: string }) => c.type === "text",
      );
      expect(textContent?.text).toContain("Please create checklist items from this document for topic: セキュリティ対策");
    });

    it("一部のトピックでチェックリスト作成失敗時も継続すること", async () => {
      // Arrange
      mockTopicExtractionAgentGenerateLegacy.mockResolvedValue({
        object: {
          topics: [
            { title: "トピック1", reason: "理由1" },
            { title: "トピック2", reason: "理由2" },
            { title: "トピック3", reason: "理由3" },
          ],
        },
      });

      // 2つ目のトピックではチェックリスト項目が生成されない
      mockTopicChecklistAgentGenerateLegacy
        .mockResolvedValueOnce({
          object: {
            checklistItems: ["チェック項目1"],
          },
        })
        .mockResolvedValueOnce({
          object: {
            checklistItems: [], // 空配列（失敗）
          },
        })
        .mockResolvedValueOnce({
          object: {
            checklistItems: ["チェック項目3"],
          },
        });

      // Act
      const run = await checklistGenerationWorkflow.createRunAsync();
      const result = await run.start({
        inputData: {
          files: testFiles,
          checklistRequirements: testChecklistRequirements,
        },
        runtimeContext: createTestRuntimeContext(),
      });

      // Assert
      // 部分的な成功でもworkflow自体は成功する
      const checkResult = checkWorkflowResult(result);
      expect(checkResult.status).toBe("success");

      expect(mockTopicChecklistAgentGenerateLegacy).toHaveBeenCalledTimes(3);

      // 結果には成功した分のみ含まれる
      if (result.status === "success") {
        const workflowResult = result.result as {
          status: string;
          generatedItems?: string[];
        };
        expect(workflowResult.generatedItems).toHaveLength(2);
        expect(workflowResult.generatedItems).toContain("チェック項目1");
        expect(workflowResult.generatedItems).toContain("チェック項目3");
      }
    });
  });

  describe("異常系", () => {
    it("fileProcessingStepが失敗した場合にworkflowが失敗すること", async () => {
      // Arrange: fileProcessingStepが失敗するようにモック
      mockFileProcessingStep.mockResolvedValue({
        status: "failed",
        errorMessage: "ファイル処理エラー",
      });

      // Act
      const run = await checklistGenerationWorkflow.createRunAsync();
      const result = await run.start({
        inputData: {
          files: testFiles,
          checklistRequirements: testChecklistRequirements,
        },
        runtimeContext: createTestRuntimeContext(),
      });

      // Assert
      const checkResult = checkWorkflowResult(result);
      expect(checkResult.status).toBe("failed");
      expect(checkResult.errorMessage).toContain("ファイル処理");

      // エージェントは呼ばれない
      expect(mockTopicExtractionAgentGenerateLegacy).not.toHaveBeenCalled();
    });

    it("トピック抽出失敗時にworkflowが失敗すること", async () => {
      // Arrange
      mockTopicExtractionAgentGenerateLegacy.mockRejectedValue(
        new Error("API呼び出しエラー"),
      );

      // Act
      const run = await checklistGenerationWorkflow.createRunAsync();
      const result = await run.start({
        inputData: {
          files: testFiles,
          checklistRequirements: testChecklistRequirements,
        },
        runtimeContext: createTestRuntimeContext(),
      });

      // Assert
      const checkResult = checkWorkflowResult(result);
      expect(checkResult.status).toBe("failed");
      // normalizeUnknownErrorにより、一般的なErrorはデフォルトメッセージに変換される
      expect(checkResult.errorMessage).toBeDefined();

      // チェックリスト作成は呼ばれない
      expect(mockTopicChecklistAgentGenerateLegacy).not.toHaveBeenCalled();
    });

    it("トピックが0件の場合の処理", async () => {
      // Arrange
      mockTopicExtractionAgentGenerateLegacy.mockResolvedValue({
        object: {
          topics: [], // 空配列
        },
      });

      // Act
      const run = await checklistGenerationWorkflow.createRunAsync();
      const result = await run.start({
        inputData: {
          files: testFiles,
          checklistRequirements: testChecklistRequirements,
        },
        runtimeContext: createTestRuntimeContext(),
      });

      // Assert
      const checkResult = checkWorkflowResult(result);
      expect(checkResult.status).toBe("failed");
      expect(checkResult.errorMessage).toContain(
        "トピックを抽出できませんでした",
      );
    });

    it("全てのチェックリスト作成が失敗した場合", async () => {
      // Arrange
      mockTopicExtractionAgentGenerateLegacy.mockResolvedValue({
        object: {
          topics: [
            { title: "トピック1", reason: "理由1" },
            { title: "トピック2", reason: "理由2" },
          ],
        },
      });

      // 全てのトピックでチェックリスト項目が生成されない
      mockTopicChecklistAgentGenerateLegacy.mockResolvedValue({
        object: {
          checklistItems: [], // 空配列（失敗）
        },
      });

      // Act
      const run = await checklistGenerationWorkflow.createRunAsync();
      const result = await run.start({
        inputData: {
          files: testFiles,
          checklistRequirements: testChecklistRequirements,
        },
        runtimeContext: createTestRuntimeContext(),
      });

      // Assert
      const checkResult = checkWorkflowResult(result);
      // 全て失敗した場合はworkflowが失敗する
      expect(checkResult.status).toBe("failed");
    });

    it("AI APIエラー時の処理", async () => {
      // Arrange
      mockTopicExtractionAgentGenerateLegacy.mockResolvedValue({
        object: {
          topics: [{ title: "トピック1", reason: "理由1" }],
        },
      });

      mockTopicChecklistAgentGenerateLegacy.mockRejectedValue(
        new Error("チェックリスト作成中にエラーが発生"),
      );

      // Act
      const run = await checklistGenerationWorkflow.createRunAsync();
      const result = await run.start({
        inputData: {
          files: testFiles,
          checklistRequirements: testChecklistRequirements,
        },
        runtimeContext: createTestRuntimeContext(),
      });

      // Assert
      const checkResult = checkWorkflowResult(result);
      expect(checkResult.status).toBe("failed");
      // normalizeUnknownErrorにより、一般的なErrorはデフォルトメッセージに変換される
      expect(checkResult.errorMessage).toBeDefined();
    });

    it("トピック抽出でtopicsがundefinedの場合", async () => {
      // Arrange
      mockTopicExtractionAgentGenerateLegacy.mockResolvedValue({
        object: {
          topics: undefined,
        },
      });

      // Act
      const run = await checklistGenerationWorkflow.createRunAsync();
      const result = await run.start({
        inputData: {
          files: testFiles,
          checklistRequirements: testChecklistRequirements,
        },
        runtimeContext: createTestRuntimeContext(),
      });

      // Assert
      const checkResult = checkWorkflowResult(result);
      expect(checkResult.status).toBe("failed");
    });
  });

  describe("画像モードのテスト", () => {
    it("画像モードのファイルも処理できること", async () => {
      // Arrange: fileProcessingStepが画像ファイルを処理した結果をモック
      mockFileProcessingStep.mockResolvedValue({
        status: "success",
        extractedFiles: [
          {
            id: "file-1",
            name: "document.pdf",
            type: "application/pdf",
            processMode: "image",
            imageData: ["base64encodedimage1", "base64encodedimage2"],
          },
        ],
        checklistRequirements: testChecklistRequirements,
      });

      const imageFiles: RawUploadFileMeta[] = [
        {
          id: "file-1",
          name: "document.pdf",
          type: "application/pdf",
          size: 5000,
          processMode: "image",
          convertedImageCount: 2,
        },
      ];

      mockTopicExtractionAgentGenerateLegacy.mockResolvedValue({
        object: {
          topics: [{ title: "画像からのトピック", reason: "理由" }],
        },
      });

      mockTopicChecklistAgentGenerateLegacy.mockResolvedValue({
        object: {
          checklistItems: ["画像からのチェック項目"],
        },
      });

      // Act
      const run = await checklistGenerationWorkflow.createRunAsync();
      const result = await run.start({
        inputData: {
          files: imageFiles,
          checklistRequirements: testChecklistRequirements,
        },
        runtimeContext: createTestRuntimeContext(),
      });

      // Assert
      const checkResult = checkWorkflowResult(result);
      expect(checkResult.status).toBe("success");

      // generateLegacyに渡されたメッセージを確認
      const callArgs = mockTopicExtractionAgentGenerateLegacy.mock.calls[0];
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

  describe("複数ファイルのテスト", () => {
    it("複数ファイル（テキスト + 画像混合）が処理できること", async () => {
      // Arrange: fileProcessingStepが混合ファイルを処理した結果をモック
      mockFileProcessingStep.mockResolvedValue({
        status: "success",
        extractedFiles: [
          {
            id: "file-1",
            name: "text-document.txt",
            type: "text/plain",
            processMode: "text",
            textContent: "テキストファイルの内容",
          },
          {
            id: "file-2",
            name: "image-document.pdf",
            type: "application/pdf",
            processMode: "image",
            imageData: ["base64encodedimage"],
          },
        ],
        checklistRequirements: testChecklistRequirements,
      });

      const mixedFiles: RawUploadFileMeta[] = [
        {
          id: "file-1",
          name: "text-document.txt",
          type: "text/plain",
          size: 1000,
          processMode: "text",
        },
        {
          id: "file-2",
          name: "image-document.pdf",
          type: "application/pdf",
          size: 5000,
          processMode: "image",
          convertedImageCount: 1,
        },
      ];

      mockTopicExtractionAgentGenerateLegacy.mockResolvedValue({
        object: {
          topics: [{ title: "混合トピック", reason: "理由" }],
        },
      });

      mockTopicChecklistAgentGenerateLegacy.mockResolvedValue({
        object: {
          checklistItems: ["混合チェック項目"],
        },
      });

      // Act
      const run = await checklistGenerationWorkflow.createRunAsync();
      const result = await run.start({
        inputData: {
          files: mixedFiles,
          checklistRequirements: testChecklistRequirements,
        },
        runtimeContext: createTestRuntimeContext(),
      });

      // Assert
      const checkResult = checkWorkflowResult(result);
      expect(checkResult.status).toBe("success");

      // メッセージにテキストと画像の両方が含まれる
      const callArgs = mockTopicExtractionAgentGenerateLegacy.mock.calls[0];
      const message = callArgs[0];

      // テキストコンテンツが含まれる
      expect(message.content).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "text",
          }),
        ]),
      );

      // 画像コンテンツが含まれる
      expect(message.content).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "image",
          }),
        ]),
      );
    });
  });
});
