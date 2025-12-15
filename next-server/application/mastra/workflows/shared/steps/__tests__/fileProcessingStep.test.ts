import { describe, it, expect, vi, beforeEach } from "vitest";
import { RuntimeContext } from "@mastra/core/di";
import { fileProcessingStep } from "../fileProcessingStep";
import { FILE_BUFFERS_CONTEXT_KEY } from "../../types";
import type { RawUploadFileMeta, FileBuffersMap, FileBufferData } from "../../types";

// FileTextExtractorをモック
vi.mock("@/infrastructure/adapter/textExtractor", () => ({
  FileTextExtractor: vi.fn().mockImplementation(() => ({
    extract: vi.fn().mockResolvedValue("抽出されたテキスト"),
  })),
}));

// loggerをモック
vi.mock("@/lib/server/logger", () => ({
  getLogger: vi.fn().mockReturnValue({
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

describe("fileProcessingStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系", () => {
    it("テキストモードでFileTextExtractorが呼ばれること", async () => {
      const fileBuffers: FileBuffersMap = new Map();
      fileBuffers.set("file-1", {
        buffer: Buffer.from("テストコンテンツ"),
      });

      const runtimeContext = new RuntimeContext();
      runtimeContext.set(FILE_BUFFERS_CONTEXT_KEY, fileBuffers);

      const inputData = {
        files: [
          {
            id: "file-1",
            name: "test.txt",
            type: "text/plain",
            size: 100,
            processMode: "text" as const,
          },
        ],
        checklistRequirements: "テスト要件",
      };

      const result = await fileProcessingStep.execute({
        inputData,
        runtimeContext,
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: vi.fn(),
      } as any);

      expect(result.status).toBe("success");
      expect(result.extractedFiles).toHaveLength(1);
      expect(result.extractedFiles![0].processMode).toBe("text");
      expect(result.extractedFiles![0].textContent).toBe("抽出されたテキスト");
      expect(result.checklistRequirements).toBe("テスト要件");
    });

    it("画像モードでBase64変換されること", async () => {
      const imageBuffer = Buffer.from("PNG画像データ");
      const fileBuffers: FileBuffersMap = new Map();
      fileBuffers.set("file-1", {
        buffer: Buffer.from("元PDFデータ"),
        convertedImageBuffers: [imageBuffer],
      });

      const runtimeContext = new RuntimeContext();
      runtimeContext.set(FILE_BUFFERS_CONTEXT_KEY, fileBuffers);

      const inputData = {
        files: [
          {
            id: "file-1",
            name: "test.pdf",
            type: "application/pdf",
            size: 100,
            processMode: "image" as const,
            convertedImageCount: 1,
          },
        ],
        checklistRequirements: "テスト要件",
      };

      const result = await fileProcessingStep.execute({
        inputData,
        runtimeContext,
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: vi.fn(),
      } as any);

      expect(result.status).toBe("success");
      expect(result.extractedFiles).toHaveLength(1);
      expect(result.extractedFiles![0].processMode).toBe("image");
      expect(result.extractedFiles![0].imageData).toHaveLength(1);
      // Data URL形式（AI APIが期待する形式）で返される
      expect(result.extractedFiles![0].imageData![0]).toBe(
        `data:image/png;base64,${imageBuffer.toString("base64")}`,
      );
    });

    it("複数ファイルが処理されること", async () => {
      const fileBuffers: FileBuffersMap = new Map();
      fileBuffers.set("file-1", {
        buffer: Buffer.from("テキストファイル1"),
      });
      fileBuffers.set("file-2", {
        buffer: Buffer.from("テキストファイル2"),
      });

      const runtimeContext = new RuntimeContext();
      runtimeContext.set(FILE_BUFFERS_CONTEXT_KEY, fileBuffers);

      const inputData = {
        files: [
          {
            id: "file-1",
            name: "test1.txt",
            type: "text/plain",
            size: 100,
            processMode: "text" as const,
          },
          {
            id: "file-2",
            name: "test2.txt",
            type: "text/plain",
            size: 200,
            processMode: "text" as const,
          },
        ],
        checklistRequirements: "テスト要件",
      };

      const result = await fileProcessingStep.execute({
        inputData,
        runtimeContext,
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: vi.fn(),
      } as any);

      expect(result.status).toBe("success");
      expect(result.extractedFiles).toHaveLength(2);
    });

    it("混合モード（テキスト+画像）が処理されること", async () => {
      const imageBuffer = Buffer.from("PNG画像データ");
      const fileBuffers: FileBuffersMap = new Map();
      fileBuffers.set("file-1", {
        buffer: Buffer.from("テキストファイル"),
      });
      fileBuffers.set("file-2", {
        buffer: Buffer.from("元PDFデータ"),
        convertedImageBuffers: [imageBuffer],
      });

      const runtimeContext = new RuntimeContext();
      runtimeContext.set(FILE_BUFFERS_CONTEXT_KEY, fileBuffers);

      const inputData = {
        files: [
          {
            id: "file-1",
            name: "test.txt",
            type: "text/plain",
            size: 100,
            processMode: "text" as const,
          },
          {
            id: "file-2",
            name: "test.pdf",
            type: "application/pdf",
            size: 200,
            processMode: "image" as const,
            convertedImageCount: 1,
          },
        ],
        checklistRequirements: "テスト要件",
      };

      const result = await fileProcessingStep.execute({
        inputData,
        runtimeContext,
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: vi.fn(),
      } as any);

      expect(result.status).toBe("success");
      expect(result.extractedFiles).toHaveLength(2);
      expect(result.extractedFiles![0].processMode).toBe("text");
      expect(result.extractedFiles![1].processMode).toBe("image");
    });

    it("複数ページのPDF画像が処理されること", async () => {
      const imageBuffer1 = Buffer.from("PNG画像データ1");
      const imageBuffer2 = Buffer.from("PNG画像データ2");
      const imageBuffer3 = Buffer.from("PNG画像データ3");
      const fileBuffers: FileBuffersMap = new Map();
      fileBuffers.set("file-1", {
        buffer: Buffer.from("元PDFデータ"),
        convertedImageBuffers: [imageBuffer1, imageBuffer2, imageBuffer3],
      });

      const runtimeContext = new RuntimeContext();
      runtimeContext.set(FILE_BUFFERS_CONTEXT_KEY, fileBuffers);

      const inputData = {
        files: [
          {
            id: "file-1",
            name: "test.pdf",
            type: "application/pdf",
            size: 100,
            processMode: "image" as const,
            convertedImageCount: 3,
          },
        ],
        checklistRequirements: "テスト要件",
      };

      const result = await fileProcessingStep.execute({
        inputData,
        runtimeContext,
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: vi.fn(),
      } as any);

      expect(result.status).toBe("success");
      expect(result.extractedFiles![0].imageData).toHaveLength(3);
    });
  });

  describe("異常系", () => {
    it("RuntimeContextにfileBuffersがない場合failedを返すこと", async () => {
      const runtimeContext = new RuntimeContext();
      // fileBuffersを設定しない

      const inputData = {
        files: [
          {
            id: "file-1",
            name: "test.txt",
            type: "text/plain",
            size: 100,
            processMode: "text" as const,
          },
        ],
        checklistRequirements: "テスト要件",
      };

      const result = await fileProcessingStep.execute({
        inputData,
        runtimeContext,
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: vi.fn(),
      } as any);

      expect(result.status).toBe("failed");
      expect(result.errorMessage).toContain(
        "RuntimeContextにファイルバッファが設定されていません",
      );
    });

    it("個別ファイルのバッファがない場合failedを返すこと", async () => {
      const fileBuffers: FileBuffersMap = new Map();
      // file-1のバッファを設定しない

      const runtimeContext = new RuntimeContext();
      runtimeContext.set(FILE_BUFFERS_CONTEXT_KEY, fileBuffers);

      const inputData = {
        files: [
          {
            id: "file-1",
            name: "test.txt",
            type: "text/plain",
            size: 100,
            processMode: "text" as const,
          },
        ],
        checklistRequirements: "テスト要件",
      };

      const result = await fileProcessingStep.execute({
        inputData,
        runtimeContext,
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: vi.fn(),
      } as any);

      expect(result.status).toBe("failed");
      expect(result.errorMessage).toContain("ファイル「test.txt」のバッファが見つかりません");
    });

    it("runtimeContextがundefinedの場合failedを返すこと", async () => {
      const inputData = {
        files: [
          {
            id: "file-1",
            name: "test.txt",
            type: "text/plain",
            size: 100,
            processMode: "text" as const,
          },
        ],
        checklistRequirements: "テスト要件",
      };

      const result = await fileProcessingStep.execute({
        inputData,
        runtimeContext: undefined,
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: vi.fn(),
      } as any);

      expect(result.status).toBe("failed");
      expect(result.errorMessage).toContain(
        "RuntimeContextにファイルバッファが設定されていません",
      );
    });

    it("ファイルテキスト抽出でエラーが発生した場合failedを返すこと", async () => {
      // FileTextExtractorのモックをエラーを投げるように設定
      const { FileTextExtractor } = await import("@/infrastructure/adapter/textExtractor");
      const mockExtract = vi.fn().mockRejectedValue(new Error("テキスト抽出エラー"));
      (FileTextExtractor as any).mockImplementation(() => ({
        extract: mockExtract,
      }));

      const fileBuffers: FileBuffersMap = new Map();
      fileBuffers.set("file-1", {
        buffer: Buffer.from("テストコンテンツ"),
      });

      const runtimeContext = new RuntimeContext();
      runtimeContext.set(FILE_BUFFERS_CONTEXT_KEY, fileBuffers);

      const inputData = {
        files: [
          {
            id: "file-1",
            name: "test.txt",
            type: "text/plain",
            size: 100,
            processMode: "text" as const,
          },
        ],
        checklistRequirements: "テスト要件",
      };

      const result = await fileProcessingStep.execute({
        inputData,
        runtimeContext,
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: vi.fn(),
      } as any);

      expect(result.status).toBe("failed");
      expect(result.errorMessage).toContain("ファイル「test.txt」の処理に失敗しました");
    });
  });
});
