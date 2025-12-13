import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  GenerateCheckListByAIService,
  type GenerateCheckListByAICommand,
} from "../GenerateCheckListByAIService";
import type { ICheckListItemRepository } from "@/application/shared/port/repository/ICheckListItemRepository";
import type { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import type { IProjectRepository } from "@/application/shared/port/repository";
import {
  ReviewSpace,
  ReviewSpaceId,
  ReviewSpaceName,
} from "@/domain/reviewSpace";
import { ProjectId } from "@/domain/project";
import { Project } from "@/domain/project";
import type { RawUploadFileMeta, FileBuffersMap } from "@/application/mastra";
import { AppError } from "@/lib/server/error";

// Mastraワークフローのモック
const mockCreateRunAsync = vi.fn();
const mockGetWorkflow = vi.fn(() => ({
  createRunAsync: mockCreateRunAsync,
}));

// checkWorkflowResultの実際の実装をインポート
import { checkWorkflowResult } from "@/application/mastra";

vi.mock("@/application/mastra", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/application/mastra")>();
  return {
    ...original,
    mastra: {
      getWorkflow: () => mockGetWorkflow(),
    },
  };
});

describe("GenerateCheckListByAIService", () => {
  // モックリポジトリ
  const mockCheckListItemRepository: ICheckListItemRepository = {
    findById: vi.fn(),
    findByIds: vi.fn(),
    findByReviewSpaceId: vi.fn(),
    countByReviewSpaceId: vi.fn(),
    save: vi.fn(),
    bulkSave: vi.fn(),
    bulkInsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    deleteByReviewSpaceId: vi.fn(),
  };

  const mockReviewSpaceRepository: IReviewSpaceRepository = {
    findById: vi.fn(),
    findByProjectId: vi.fn(),
    countByProjectId: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };

  const mockProjectRepository: IProjectRepository = {
    findById: vi.fn(),
    findByMemberId: vi.fn(),
    countByMemberId: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };

  let service: GenerateCheckListByAIService;

  // テスト用データ（有効なUUID v4形式）
  const testProjectId = "550e8400-e29b-41d4-a716-446655440001";
  const testReviewSpaceId = "550e8400-e29b-41d4-a716-446655440002";
  const testUserId = "550e8400-e29b-41d4-a716-446655440003";

  const testProject = Project.reconstruct({
    id: testProjectId,
    name: "テストプロジェクト",
    description: null,
    encryptedApiKey: null,
    members: [{ userId: testUserId, createdAt: new Date() }],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const testReviewSpace = ReviewSpace.reconstruct({
    id: testReviewSpaceId,
    projectId: testProjectId,
    name: "テストスペース",
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // テスト用ファイルメタデータ（RawUploadFileMeta形式）
  const testFiles: RawUploadFileMeta[] = [
    {
      id: "file-1",
      name: "test.txt",
      type: "text/plain",
      size: 1000,
      processMode: "text",
    },
  ];

  // テスト用ファイルバッファ
  const createTestFileBuffers = (): FileBuffersMap => {
    const map: FileBuffersMap = new Map();
    map.set("file-1", {
      buffer: Buffer.from("テストドキュメントの内容"),
    });
    return map;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GenerateCheckListByAIService(
      mockCheckListItemRepository,
      mockReviewSpaceRepository,
      mockProjectRepository,
    );
  });

  describe("正常系", () => {
    it("AIでチェックリストを生成して保存する", async () => {
      // モックの設定
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);

      const generatedItems = [
        "チェック項目1",
        "チェック項目2",
        "チェック項目3",
      ];
      mockCreateRunAsync.mockResolvedValue({
        start: vi.fn().mockResolvedValue({
          status: "success",
          result: {
            status: "success",
            generatedItems,
            totalCount: 3,
          },
        }),
      });

      const command: GenerateCheckListByAICommand = {
        reviewSpaceId: testReviewSpaceId,
        userId: testUserId,
        files: testFiles,
        fileBuffers: createTestFileBuffers(),
        checklistRequirements: "システム設計のチェックポイント",
      };

      const result = await service.execute(command);

      expect(result.generatedCount).toBe(3);
      expect(result.items).toEqual(generatedItems);
      expect(mockCheckListItemRepository.bulkInsert).toHaveBeenCalledTimes(1);
      expect(mockCheckListItemRepository.bulkInsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            content: expect.objectContaining({ value: "チェック項目1" }),
          }),
          expect.objectContaining({
            content: expect.objectContaining({ value: "チェック項目2" }),
          }),
          expect.objectContaining({
            content: expect.objectContaining({ value: "チェック項目3" }),
          }),
        ]),
      );
    });

    it("画像モードのファイルも処理できる", async () => {
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);

      const generatedItems = ["画像からのチェック項目"];
      mockCreateRunAsync.mockResolvedValue({
        start: vi.fn().mockResolvedValue({
          status: "success",
          result: {
            status: "success",
            generatedItems,
            totalCount: 1,
          },
        }),
      });

      const filesWithImage: RawUploadFileMeta[] = [
        {
          id: "file-1",
          name: "document.pdf",
          type: "application/pdf",
          size: 5000,
          processMode: "image",
          convertedImageCount: 1,
        },
      ];

      const imageFileBuffers: FileBuffersMap = new Map();
      imageFileBuffers.set("file-1", {
        buffer: Buffer.from("元PDFデータ"),
        convertedImageBuffers: [Buffer.from("PNG画像データ")],
      });

      const command: GenerateCheckListByAICommand = {
        reviewSpaceId: testReviewSpaceId,
        userId: testUserId,
        files: filesWithImage,
        fileBuffers: imageFileBuffers,
        checklistRequirements: "ドキュメントからチェックリストを生成",
      };

      const result = await service.execute(command);

      expect(result.generatedCount).toBe(1);
      expect(result.items).toEqual(generatedItems);
    });
  });

  describe("異常系", () => {
    it("ファイルが空の場合エラーになる", async () => {
      const command: GenerateCheckListByAICommand = {
        reviewSpaceId: testReviewSpaceId,
        userId: testUserId,
        files: [],
        fileBuffers: new Map(),
        checklistRequirements: "テスト要件",
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "AI_CHECKLIST_GENERATION_NO_FILES",
      });
    });

    it("チェックリスト生成要件が空の場合エラーになる", async () => {
      const command: GenerateCheckListByAICommand = {
        reviewSpaceId: testReviewSpaceId,
        userId: testUserId,
        files: testFiles,
        fileBuffers: createTestFileBuffers(),
        checklistRequirements: "",
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "AI_CHECKLIST_GENERATION_REQUIREMENTS_EMPTY",
      });
    });

    it("チェックリスト生成要件が空白のみの場合もエラーになる", async () => {
      const command: GenerateCheckListByAICommand = {
        reviewSpaceId: testReviewSpaceId,
        userId: testUserId,
        files: testFiles,
        fileBuffers: createTestFileBuffers(),
        checklistRequirements: "   ",
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "AI_CHECKLIST_GENERATION_REQUIREMENTS_EMPTY",
      });
    });

    it("レビュースペースが存在しない場合エラーになる", async () => {
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(null);

      const command: GenerateCheckListByAICommand = {
        reviewSpaceId: testReviewSpaceId,
        userId: testUserId,
        files: testFiles,
        fileBuffers: createTestFileBuffers(),
        checklistRequirements: "テスト要件",
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "REVIEW_SPACE_NOT_FOUND",
      });
    });

    it("プロジェクトが存在しない場合エラーになる", async () => {
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(null);

      const command: GenerateCheckListByAICommand = {
        reviewSpaceId: testReviewSpaceId,
        userId: testUserId,
        files: testFiles,
        fileBuffers: createTestFileBuffers(),
        checklistRequirements: "テスト要件",
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "PROJECT_NOT_FOUND",
      });
    });

    it("プロジェクトメンバーでない場合エラーになる", async () => {
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);

      // メンバーではないが有効なUUID形式のユーザーID
      const nonMemberUserId = "550e8400-e29b-41d4-a716-446655440099";
      const command: GenerateCheckListByAICommand = {
        reviewSpaceId: testReviewSpaceId,
        userId: nonMemberUserId,
        files: testFiles,
        fileBuffers: createTestFileBuffers(),
        checklistRequirements: "テスト要件",
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "PROJECT_ACCESS_DENIED",
      });
    });

    it("ワークフローが失敗した場合エラーになる", async () => {
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);

      mockCreateRunAsync.mockResolvedValue({
        start: vi.fn().mockResolvedValue({
          status: "failed",
          result: {
            status: "failed",
            errorMessage: "AI処理に失敗しました",
          },
        }),
      });

      const command: GenerateCheckListByAICommand = {
        reviewSpaceId: testReviewSpaceId,
        userId: testUserId,
        files: testFiles,
        fileBuffers: createTestFileBuffers(),
        checklistRequirements: "テスト要件",
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "AI_CHECKLIST_GENERATION_FAILED",
      });
    });

    it("生成されたアイテムが0件の場合エラーになる", async () => {
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);

      mockCreateRunAsync.mockResolvedValue({
        start: vi.fn().mockResolvedValue({
          status: "success",
          result: {
            status: "success",
            generatedItems: [],
            totalCount: 0,
          },
        }),
      });

      const command: GenerateCheckListByAICommand = {
        reviewSpaceId: testReviewSpaceId,
        userId: testUserId,
        files: testFiles,
        fileBuffers: createTestFileBuffers(),
        checklistRequirements: "テスト要件",
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "AI_CHECKLIST_GENERATION_NO_ITEMS_GENERATED",
      });
    });
  });
});
