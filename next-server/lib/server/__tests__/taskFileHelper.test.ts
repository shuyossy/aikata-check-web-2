import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import { TaskFileHelper } from "../taskFileHelper";

// fs/promisesをモック
vi.mock("fs/promises");

describe("TaskFileHelper", () => {
  const testTaskId = "550e8400-e29b-41d4-a716-446655440000";
  const testFileId = "660e8400-e29b-41d4-a716-446655440001";
  const originalEnv = process.env.QUEUE_FILE_DIR;

  beforeEach(() => {
    vi.clearAllMocks();
    // デフォルトのファイルディレクトリを使用
    delete process.env.QUEUE_FILE_DIR;
  });

  afterEach(() => {
    // 環境変数を元に戻す
    if (originalEnv !== undefined) {
      process.env.QUEUE_FILE_DIR = originalEnv;
    } else {
      delete process.env.QUEUE_FILE_DIR;
    }
  });

  describe("getFileBaseDir", () => {
    it("環境変数が設定されていない場合はデフォルト値を返す", () => {
      const baseDir = TaskFileHelper.getFileBaseDir();
      expect(baseDir).toBe("./queue_files");
    });

    it("環境変数が設定されている場合はその値を返す", () => {
      process.env.QUEUE_FILE_DIR = "/custom/queue/dir";
      const baseDir = TaskFileHelper.getFileBaseDir();
      expect(baseDir).toBe("/custom/queue/dir");
    });
  });

  describe("getTaskDir", () => {
    it("タスクIDに基づくディレクトリパスを返す", () => {
      const taskDir = TaskFileHelper.getTaskDir(testTaskId);
      expect(taskDir).toBe(path.join("./queue_files", testTaskId));
    });
  });

  describe("getFilePath", () => {
    it("ファイルの保存先パスを返す", () => {
      const filePath = TaskFileHelper.getFilePath(
        testTaskId,
        testFileId,
        "document.pdf",
      );
      expect(filePath).toBe(
        path.join("./queue_files", testTaskId, `${testFileId}.pdf`),
      );
    });

    it("拡張子がないファイル名でも正しく処理する", () => {
      const filePath = TaskFileHelper.getFilePath(
        testTaskId,
        testFileId,
        "document",
      );
      expect(filePath).toBe(
        path.join("./queue_files", testTaskId, testFileId),
      );
    });
  });

  describe("saveFile", () => {
    it("ファイルを保存してパスを返す", async () => {
      const buffer = Buffer.from("test content");
      const fileName = "test.pdf";
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await TaskFileHelper.saveFile(
        testTaskId,
        testFileId,
        buffer,
        fileName,
      );

      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join("./queue_files", testTaskId),
        { recursive: true },
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join("./queue_files", testTaskId, `${testFileId}.pdf`),
        buffer,
      );
      expect(result).toBe(
        path.join("./queue_files", testTaskId, `${testFileId}.pdf`),
      );
    });

    it("空のバッファでも保存できる", async () => {
      const buffer = Buffer.from("");
      const fileName = "empty.txt";
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await TaskFileHelper.saveFile(
        testTaskId,
        testFileId,
        buffer,
        fileName,
      );

      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join("./queue_files", testTaskId, `${testFileId}.txt`),
        buffer,
      );
      expect(result).toBe(
        path.join("./queue_files", testTaskId, `${testFileId}.txt`),
      );
    });
  });

  describe("loadFile", () => {
    it("ファイルを読み込む", async () => {
      const expectedBuffer = Buffer.from("test content");
      const filePath = "/queue/test.pdf";
      vi.mocked(fs.readFile).mockResolvedValue(expectedBuffer as never);

      const result = await TaskFileHelper.loadFile(filePath);

      expect(fs.readFile).toHaveBeenCalledWith(filePath);
      expect(result).toEqual(expectedBuffer);
    });
  });

  describe("deleteTaskFiles", () => {
    it("タスクのファイルディレクトリを削除する", async () => {
      vi.mocked(fs.rm).mockResolvedValue(undefined);

      await TaskFileHelper.deleteTaskFiles(testTaskId);

      expect(fs.rm).toHaveBeenCalledWith(
        path.join("./queue_files", testTaskId),
        { recursive: true, force: true },
      );
    });

    it("ディレクトリが存在しない場合でもエラーにならない", async () => {
      vi.mocked(fs.rm).mockRejectedValue(new Error("ENOENT"));

      // エラーがスローされないことを確認
      await expect(
        TaskFileHelper.deleteTaskFiles(testTaskId),
      ).resolves.not.toThrow();
    });
  });

  describe("deleteFile", () => {
    it("ファイルを削除する", async () => {
      const filePath = "/queue/test.pdf";
      vi.mocked(fs.unlink).mockResolvedValue(undefined);

      await TaskFileHelper.deleteFile(filePath);

      expect(fs.unlink).toHaveBeenCalledWith(filePath);
    });

    it("ファイルが存在しない場合でもエラーにならない", async () => {
      vi.mocked(fs.unlink).mockRejectedValue(new Error("ENOENT"));

      // エラーがスローされないことを確認
      await expect(
        TaskFileHelper.deleteFile("/nonexistent.pdf"),
      ).resolves.not.toThrow();
    });
  });

  describe("exists", () => {
    it("パスが存在する場合はtrueを返す", async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const result = await TaskFileHelper.exists("/queue/test.pdf");

      expect(result).toBe(true);
    });

    it("パスが存在しない場合はfalseを返す", async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"));

      const result = await TaskFileHelper.exists("/queue/nonexistent.pdf");

      expect(result).toBe(false);
    });
  });

  describe("ensureBaseDir", () => {
    it("ベースディレクトリを作成する", async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      await TaskFileHelper.ensureBaseDir();

      expect(fs.mkdir).toHaveBeenCalledWith("./queue_files", { recursive: true });
    });
  });

  describe("listTaskFiles", () => {
    it("タスクディレクトリ内のファイル一覧を返す", async () => {
      const files = ["file1.pdf", "file2.docx"];
      vi.mocked(fs.readdir).mockResolvedValue(files as unknown as never[]);

      const result = await TaskFileHelper.listTaskFiles(testTaskId);

      expect(fs.readdir).toHaveBeenCalledWith(
        path.join("./queue_files", testTaskId),
      );
      expect(result).toEqual([
        path.join("./queue_files", testTaskId, "file1.pdf"),
        path.join("./queue_files", testTaskId, "file2.docx"),
      ]);
    });

    it("ディレクトリが存在しない場合は空配列を返す", async () => {
      vi.mocked(fs.readdir).mockRejectedValue(new Error("ENOENT"));

      const result = await TaskFileHelper.listTaskFiles(testTaskId);

      expect(result).toEqual([]);
    });
  });
});
