import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  AiTask,
  AI_TASK_TYPE,
  AI_TASK_STATUS,
  CreateAiTaskParams,
  ReconstructAiTaskParams,
} from "../AiTask";
import { AiTaskFileMetadata } from "../AiTaskFileMetadata";

describe("AiTask", () => {
  const baseCreateParams: CreateAiTaskParams = {
    taskType: "small_review",
    apiKey: "test-api-key-12345",
    payload: { reviewTargetId: "target-123", checkListItems: [] },
  };

  const mockDate = new Date("2024-01-15T10:00:00Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("正常系", () => {
    describe("create", () => {
      it("queuedステータスで新規タスクが作成される", () => {
        const task = AiTask.create(baseCreateParams);

        expect(task.status.value).toBe(AI_TASK_STATUS.QUEUED);
        expect(task.taskType.value).toBe(AI_TASK_TYPE.SMALL_REVIEW);
        expect(task.payload).toEqual(baseCreateParams.payload);
        expect(task.errorMessage).toBeNull();
        expect(task.startedAt).toBeNull();
        expect(task.completedAt).toBeNull();
      });

      it("優先度指定なしの場合デフォルト優先度（NORMAL）が設定される", () => {
        const task = AiTask.create(baseCreateParams);

        expect(task.priority.value).toBe(5);
      });

      it("優先度を指定してタスクを作成できる", () => {
        const task = AiTask.create({
          ...baseCreateParams,
          priority: 10,
        });

        expect(task.priority.value).toBe(10);
      });

      it("ファイルメタデータを指定してタスクを作成できる", () => {
        const fileMetadata = AiTaskFileMetadata.create({
          fileName: "test.txt",
          fileSize: 1024,
          mimeType: "text/plain",
        });

        const task = AiTask.create({
          ...baseCreateParams,
          fileMetadata: [fileMetadata],
        });

        expect(task.fileMetadata).toHaveLength(1);
        expect(task.fileMetadata[0].fileName).toBe("test.txt");
      });

      it("APIキーがハッシュ化されて保存される", () => {
        const task = AiTask.create(baseCreateParams);

        // ハッシュ化されたAPIキーは元のAPIキーとは異なる
        expect(task.apiKeyHash).not.toBe(baseCreateParams.apiKey);
        // ハッシュ値は64文字（SHA-256）
        expect(task.apiKeyHash).toHaveLength(64);
      });
    });

    describe("reconstruct", () => {
      it("DBデータからタスクを復元できる", () => {
        const reconstructParams: ReconstructAiTaskParams = {
          id: "550e8400-e29b-41d4-a716-446655440000",
          taskType: "large_review",
          status: "processing",
          apiKeyHash: "hashed-api-key",
          priority: 8,
          payload: { reviewTargetId: "target-456" },
          errorMessage: null,
          createdAt: new Date("2024-01-10T10:00:00Z"),
          updatedAt: new Date("2024-01-10T12:00:00Z"),
          startedAt: new Date("2024-01-10T11:00:00Z"),
          completedAt: null,
          fileMetadata: [],
        };

        const task = AiTask.reconstruct(reconstructParams);

        expect(task.id.value).toBe(reconstructParams.id);
        expect(task.taskType.value).toBe(AI_TASK_TYPE.LARGE_REVIEW);
        expect(task.status.value).toBe(AI_TASK_STATUS.PROCESSING);
        expect(task.apiKeyHash).toBe("hashed-api-key");
        expect(task.priority.value).toBe(8);
        expect(task.startedAt).toEqual(reconstructParams.startedAt);
      });

      it("ファイルメタデータを含むタスクを復元できる", () => {
        const reconstructParams: ReconstructAiTaskParams = {
          id: "550e8400-e29b-41d4-a716-446655440000",
          taskType: "checklist_generation",
          status: "queued",
          apiKeyHash: "hashed-api-key",
          priority: 5,
          payload: {},
          errorMessage: null,
          createdAt: new Date("2024-01-10T10:00:00Z"),
          updatedAt: new Date("2024-01-10T10:00:00Z"),
          startedAt: null,
          completedAt: null,
          fileMetadata: [
            {
              id: "660e8400-e29b-41d4-a716-446655440001",
              taskId: "550e8400-e29b-41d4-a716-446655440000",
              fileName: "document.pdf",
              filePath: "/uploads/document.pdf",
              fileSize: 2048,
              mimeType: "application/pdf",
              processMode: "text",
              convertedImageCount: 0,
              createdAt: new Date("2024-01-10T10:00:00Z"),
            },
          ],
        };

        const task = AiTask.reconstruct(reconstructParams);

        expect(task.fileMetadata).toHaveLength(1);
        expect(task.fileMetadata[0].fileName).toBe("document.pdf");
        expect(task.fileMetadata[0].filePath).toBe("/uploads/document.pdf");
      });
    });

    describe("状態遷移", () => {
      it("startProcessing()でqueued → processingに遷移する", () => {
        const task = AiTask.create(baseCreateParams);
        const processingTask = task.startProcessing();

        expect(processingTask.status.value).toBe(AI_TASK_STATUS.PROCESSING);
        expect(processingTask.startedAt).toEqual(mockDate);
      });

      it("completeWithSuccess()でprocessing → completedに遷移する", () => {
        const task = AiTask.create(baseCreateParams);
        const processingTask = task.startProcessing();
        const completedTask = processingTask.completeWithSuccess();

        expect(completedTask.status.value).toBe(AI_TASK_STATUS.COMPLETED);
        expect(completedTask.completedAt).toEqual(mockDate);
        expect(completedTask.errorMessage).toBeNull();
      });

      it("failWithError()でprocessing → failedに遷移する", () => {
        const task = AiTask.create(baseCreateParams);
        const processingTask = task.startProcessing();
        const failedTask = processingTask.failWithError(
          "API rate limit exceeded",
        );

        expect(failedTask.status.value).toBe(AI_TASK_STATUS.FAILED);
        expect(failedTask.completedAt).toEqual(mockDate);
        expect(failedTask.errorMessage).toBe("API rate limit exceeded");
      });
    });

    describe("getters", () => {
      it("全てのプロパティにアクセスできる", () => {
        const task = AiTask.create(baseCreateParams);

        expect(task.id).toBeDefined();
        expect(task.taskType).toBeDefined();
        expect(task.status).toBeDefined();
        expect(task.apiKeyHash).toBeDefined();
        expect(task.priority).toBeDefined();
        expect(task.payload).toBeDefined();
        expect(task.errorMessage).toBeNull();
        expect(task.createdAt).toEqual(mockDate);
        expect(task.updatedAt).toEqual(mockDate);
        expect(task.startedAt).toBeNull();
        expect(task.completedAt).toBeNull();
        expect(task.fileMetadata).toEqual([]);
      });
    });

    describe("toDto", () => {
      it("DTOに変換できる", () => {
        const task = AiTask.create(baseCreateParams);
        const dto = task.toDto();

        expect(dto.id).toBe(task.id.value);
        expect(dto.taskType).toBe(AI_TASK_TYPE.SMALL_REVIEW);
        expect(dto.status).toBe(AI_TASK_STATUS.QUEUED);
        expect(dto.apiKeyHash).toBe(task.apiKeyHash);
        expect(dto.priority).toBe(5);
        expect(dto.payload).toEqual(baseCreateParams.payload);
        expect(dto.errorMessage).toBeNull();
        expect(dto.createdAt).toEqual(mockDate);
        expect(dto.updatedAt).toEqual(mockDate);
        expect(dto.startedAt).toBeNull();
        expect(dto.completedAt).toBeNull();
        expect(dto.fileMetadata).toEqual([]);
      });

      it("ファイルメタデータを含むDTOに変換できる", () => {
        const fileMetadata = AiTaskFileMetadata.create({
          fileName: "test.txt",
          fileSize: 1024,
          mimeType: "text/plain",
        });

        const task = AiTask.create({
          ...baseCreateParams,
          fileMetadata: [fileMetadata],
        });
        const dto = task.toDto();

        expect(dto.fileMetadata).toHaveLength(1);
        expect(dto.fileMetadata[0].fileName).toBe("test.txt");
      });
    });

    describe("不変性", () => {
      it("状態遷移後も元のインスタンスは変更されない", () => {
        const task = AiTask.create(baseCreateParams);
        const processingTask = task.startProcessing();

        expect(task.status.value).toBe(AI_TASK_STATUS.QUEUED);
        expect(processingTask.status.value).toBe(AI_TASK_STATUS.PROCESSING);
      });

      it("IDは状態遷移後も同じ", () => {
        const task = AiTask.create(baseCreateParams);
        const processingTask = task.startProcessing();
        const completedTask = processingTask.completeWithSuccess();

        expect(task.id.value).toBe(processingTask.id.value);
        expect(task.id.value).toBe(completedTask.id.value);
      });
    });
  });

  describe("異常系", () => {
    describe("不正な状態遷移", () => {
      it("queued状態からcompleteWithSuccess()でエラーをスローする", () => {
        const task = AiTask.create(baseCreateParams);

        expect(() => task.completeWithSuccess()).toThrow();
      });

      it("queued状態からfailWithError()でエラーをスローする", () => {
        const task = AiTask.create(baseCreateParams);

        expect(() => task.failWithError("error")).toThrow();
      });

      it("processing状態からstartProcessing()でエラーをスローする", () => {
        const task = AiTask.create(baseCreateParams);
        const processingTask = task.startProcessing();

        expect(() => processingTask.startProcessing()).toThrow();
      });

      it("completed状態からstartProcessing()でエラーをスローする", () => {
        const task = AiTask.create(baseCreateParams);
        const completedTask = task.startProcessing().completeWithSuccess();

        expect(() => completedTask.startProcessing()).toThrow();
      });

      it("failed状態からstartProcessing()でエラーをスローする", () => {
        const task = AiTask.create(baseCreateParams);
        const failedTask = task.startProcessing().failWithError("error");

        expect(() => failedTask.startProcessing()).toThrow();
      });
    });

    describe("不正なパラメータ", () => {
      it("無効なタスクタイプでエラーをスローする", () => {
        expect(() =>
          AiTask.create({
            ...baseCreateParams,
            taskType: "invalid_type",
          }),
        ).toThrow();
      });

      it("無効な優先度でエラーをスローする", () => {
        expect(() =>
          AiTask.create({
            ...baseCreateParams,
            priority: 0,
          }),
        ).toThrow();

        expect(() =>
          AiTask.create({
            ...baseCreateParams,
            priority: 11,
          }),
        ).toThrow();
      });
    });
  });
});
