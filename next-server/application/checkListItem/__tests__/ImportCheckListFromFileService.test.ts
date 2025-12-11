import { describe, it, expect, vi, beforeEach } from "vitest";
import { ImportCheckListFromFileService } from "../ImportCheckListFromFileService";
import { ICheckListItemRepository } from "@/application/shared/port/repository/ICheckListItemRepository";
import { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import { IProjectRepository } from "@/application/shared/port/repository";
import type { IFileTextExtractor } from "@/application/shared/port/textExtractor";
import { Project } from "@/domain/project";
import { ReviewSpace } from "@/domain/reviewSpace";

// 暗号化関数をモック
vi.mock("@/lib/server/encryption", () => ({
  encrypt: vi.fn((text: string) => `encrypted_${text}`),
  decrypt: vi.fn((text: string) => text.replace("encrypted_", "")),
}));

describe("ImportCheckListFromFileService", () => {
  let mockFileTextExtractor: IFileTextExtractor;
  let mockCheckListItemRepository: ICheckListItemRepository;
  let mockReviewSpaceRepository: IReviewSpaceRepository;
  let mockProjectRepository: IProjectRepository;
  let service: ImportCheckListFromFileService;

  const validProjectId = "123e4567-e89b-12d3-a456-426614174000";
  const validReviewSpaceId = "223e4567-e89b-12d3-a456-426614174001";
  const validUserId = "323e4567-e89b-12d3-a456-426614174002";

  const mockProject = Project.reconstruct({
    id: validProjectId,
    name: "テストプロジェクト",
    description: "テスト説明",
    encryptedApiKey: null,
    members: [{ userId: validUserId, createdAt: new Date() }],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const mockReviewSpace = ReviewSpace.reconstruct({
    id: validReviewSpaceId,
    projectId: validProjectId,
    name: "テストスペース",
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(() => {
    // FileTextExtractorのモック - stringを返す
    mockFileTextExtractor = {
      extract: vi.fn().mockResolvedValue("項目1\n項目2\n項目3"),
      getAvailableStrategies: vi.fn().mockReturnValue(["txt-default"]),
      isSupported: vi.fn().mockReturnValue(true),
    };
    mockCheckListItemRepository = {
      findById: vi.fn(),
      findByIds: vi.fn().mockResolvedValue([]),
      findByReviewSpaceId: vi.fn().mockResolvedValue([]),
      countByReviewSpaceId: vi.fn().mockResolvedValue(0),
      save: vi.fn(),
      bulkSave: vi.fn(),
      bulkInsert: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      deleteByReviewSpaceId: vi.fn(),
    };
    mockReviewSpaceRepository = {
      findById: vi.fn().mockResolvedValue(mockReviewSpace),
      findByProjectId: vi.fn(),
      countByProjectId: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };
    mockProjectRepository = {
      findById: vi.fn().mockResolvedValue(mockProject),
      findByMemberId: vi.fn(),
      countByMemberId: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };
    service = new ImportCheckListFromFileService(
      mockFileTextExtractor,
      mockCheckListItemRepository,
      mockReviewSpaceRepository,
      mockProjectRepository,
    );
  });

  describe("正常系", () => {
    it("txtファイルからチェックリストをインポートできる", async () => {
      const fileBuffer = Buffer.from("項目1\n項目2\n項目3", "utf-8");
      vi.mocked(mockFileTextExtractor.extract).mockResolvedValue(
        "項目1\n項目2\n項目3",
      );

      const result = await service.execute({
        reviewSpaceId: validReviewSpaceId,
        userId: validUserId,
        fileBuffer,
        fileName: "checklist.txt",
      });

      expect(result.importedCount).toBe(3);
      expect(result.fileType).toBe("txt");
      expect(mockCheckListItemRepository.bulkInsert).toHaveBeenCalledTimes(1);

      // bulkInsertの第1引数（チェック項目配列）を取得
      const savedItems = vi.mocked(mockCheckListItemRepository.bulkInsert).mock
        .calls[0][0];

      expect(savedItems).toHaveLength(3);
      expect(savedItems[0].content.value).toBe("項目1");
      expect(savedItems[1].content.value).toBe("項目2");
      expect(savedItems[2].content.value).toBe("項目3");
    });

    it("csvファイルからチェックリストをインポートできる", async () => {
      const fileBuffer = Buffer.from("項目1,値1\n項目2,値2", "utf-8");
      vi.mocked(mockFileTextExtractor.extract).mockResolvedValue(
        "項目1,値1\n項目2,値2",
      );

      const result = await service.execute({
        reviewSpaceId: validReviewSpaceId,
        userId: validUserId,
        fileBuffer,
        fileName: "checklist.csv",
      });

      expect(result.importedCount).toBe(2);
      expect(result.fileType).toBe("csv");
    });

    it("xlsxファイルからチェックリストをインポートできる", async () => {
      const fileBuffer = Buffer.from("dummy xlsx content");
      // XlsxSheetJsStrategyが返す形式（#sheet:シート名\nCSV形式）
      vi.mocked(mockFileTextExtractor.extract).mockResolvedValue(
        "#sheet:Sheet1\n項目1\n項目2",
      );

      const result = await service.execute({
        reviewSpaceId: validReviewSpaceId,
        userId: validUserId,
        fileBuffer,
        fileName: "checklist.xlsx",
      });

      expect(result.importedCount).toBe(2);
      expect(result.fileType).toBe("xlsx");
    });

    it("xlsファイルからチェックリストをインポートできる", async () => {
      const fileBuffer = Buffer.from("dummy xls content");
      vi.mocked(mockFileTextExtractor.extract).mockResolvedValue(
        "#sheet:Sheet1\n項目1\n項目2",
      );

      const result = await service.execute({
        reviewSpaceId: validReviewSpaceId,
        userId: validUserId,
        fileBuffer,
        fileName: "checklist.xls",
      });

      expect(result.importedCount).toBe(2);
      expect(result.fileType).toBe("xlsx");
    });

    it("ヘッダー行スキップオプションが適用される（txtファイル）", async () => {
      const fileBuffer = Buffer.from("ヘッダー\n項目1\n項目2", "utf-8");
      vi.mocked(mockFileTextExtractor.extract).mockResolvedValue(
        "ヘッダー\n項目1\n項目2",
      );

      const result = await service.execute({
        reviewSpaceId: validReviewSpaceId,
        userId: validUserId,
        fileBuffer,
        fileName: "checklist.txt",
        options: { skipHeaderRow: true },
      });

      // ヘッダー行がスキップされて2件になる
      expect(result.importedCount).toBe(2);
    });

    it("空行は常に除外される（txtファイル）", async () => {
      const fileBuffer = Buffer.from("項目1\n\n項目2", "utf-8");
      vi.mocked(mockFileTextExtractor.extract).mockResolvedValue(
        "項目1\n\n項目2",
      );

      const result = await service.execute({
        reviewSpaceId: validReviewSpaceId,
        userId: validUserId,
        fileBuffer,
        fileName: "checklist.txt",
      });

      // 空行は常に除外されて2件になる
      expect(result.importedCount).toBe(2);
    });

    it("大文字拡張子も処理できる", async () => {
      const fileBuffer = Buffer.from("項目1\n項目2", "utf-8");
      vi.mocked(mockFileTextExtractor.extract).mockResolvedValue("項目1\n項目2");

      const result = await service.execute({
        reviewSpaceId: validReviewSpaceId,
        userId: validUserId,
        fileBuffer,
        fileName: "checklist.TXT",
      });

      expect(result.fileType).toBe("txt");
    });

    it("複数シートのxlsxから全項目をインポートできる", async () => {
      const fileBuffer = Buffer.from("dummy xlsx content");
      vi.mocked(mockFileTextExtractor.extract).mockResolvedValue(
        "#sheet:Sheet1\n項目1\n項目2\n#sheet:Sheet2\n項目3\n項目4",
      );

      const result = await service.execute({
        reviewSpaceId: validReviewSpaceId,
        userId: validUserId,
        fileBuffer,
        fileName: "checklist.xlsx",
      });

      expect(result.importedCount).toBe(4);
    });

    it("xlsxでヘッダー行スキップが各シートに適用される", async () => {
      const fileBuffer = Buffer.from("dummy xlsx content");
      vi.mocked(mockFileTextExtractor.extract).mockResolvedValue(
        "#sheet:Sheet1\nヘッダー1\n項目1\n#sheet:Sheet2\nヘッダー2\n項目2",
      );

      const result = await service.execute({
        reviewSpaceId: validReviewSpaceId,
        userId: validUserId,
        fileBuffer,
        fileName: "checklist.xlsx",
        options: { skipHeaderRow: true },
      });

      // 各シートのヘッダー行がスキップされて2件
      expect(result.importedCount).toBe(2);
    });
  });

  describe("異常系", () => {
    it("サポートされていないファイル形式の場合はエラー", async () => {
      vi.mocked(mockFileTextExtractor.isSupported).mockReturnValue(false);
      const fileBuffer = Buffer.from("content");

      await expect(
        service.execute({
          reviewSpaceId: validReviewSpaceId,
          userId: validUserId,
          fileBuffer,
          fileName: "checklist.pdf",
        }),
      ).rejects.toMatchObject({
        messageCode: "CHECK_LIST_FILE_IMPORT_UNSUPPORTED_FORMAT",
      });
    });

    it("存在しないレビュースペースの場合はエラー", async () => {
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(null);
      const fileBuffer = Buffer.from("項目1\n項目2", "utf-8");

      await expect(
        service.execute({
          reviewSpaceId: validReviewSpaceId,
          userId: validUserId,
          fileBuffer,
          fileName: "checklist.txt",
        }),
      ).rejects.toMatchObject({ messageCode: "REVIEW_SPACE_NOT_FOUND" });
    });

    it("存在しないプロジェクトの場合はエラー", async () => {
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(null);
      const fileBuffer = Buffer.from("項目1\n項目2", "utf-8");

      await expect(
        service.execute({
          reviewSpaceId: validReviewSpaceId,
          userId: validUserId,
          fileBuffer,
          fileName: "checklist.txt",
        }),
      ).rejects.toMatchObject({ messageCode: "PROJECT_NOT_FOUND" });
    });

    it("プロジェクトにアクセス権がない場合はエラー", async () => {
      const otherUserId = "623e4567-e89b-12d3-a456-426614174005";
      const fileBuffer = Buffer.from("項目1\n項目2", "utf-8");

      await expect(
        service.execute({
          reviewSpaceId: validReviewSpaceId,
          userId: otherUserId,
          fileBuffer,
          fileName: "checklist.txt",
        }),
      ).rejects.toMatchObject({ messageCode: "PROJECT_ACCESS_DENIED" });
    });

    it("抽出された項目が0件の場合はエラー", async () => {
      vi.mocked(mockFileTextExtractor.extract).mockResolvedValue("");
      const fileBuffer = Buffer.from("", "utf-8");

      await expect(
        service.execute({
          reviewSpaceId: validReviewSpaceId,
          userId: validUserId,
          fileBuffer,
          fileName: "checklist.txt",
        }),
      ).rejects.toMatchObject({
        messageCode: "CHECK_LIST_FILE_IMPORT_NO_ITEMS",
      });
    });

    it("ファイル解析でエラーが発生した場合はエラー", async () => {
      vi.mocked(mockFileTextExtractor.extract).mockRejectedValue(
        new Error("クォートが正しく閉じられていません"),
      );
      const fileBuffer = Buffer.from('"項目1\n項目2', "utf-8");

      await expect(
        service.execute({
          reviewSpaceId: validReviewSpaceId,
          userId: validUserId,
          fileBuffer,
          fileName: "checklist.csv",
        }),
      ).rejects.toMatchObject({
        messageCode: "CHECK_LIST_FILE_IMPORT_PARSE_ERROR",
      });
    });

    it("リポジトリでエラーが発生した場合はスロー", async () => {
      vi.mocked(mockCheckListItemRepository.bulkInsert).mockRejectedValue(
        new Error("DB Error"),
      );
      const fileBuffer = Buffer.from("項目1\n項目2", "utf-8");

      await expect(
        service.execute({
          reviewSpaceId: validReviewSpaceId,
          userId: validUserId,
          fileBuffer,
          fileName: "checklist.txt",
        }),
      ).rejects.toThrow("DB Error");
    });
  });
});
