import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ExecuteReviewService,
  type ExecuteReviewCommand,
} from "../ExecuteReviewService";
import type { IReviewTargetRepository } from "@/application/shared/port/repository/IReviewTargetRepository";
import type { IReviewResultRepository } from "@/application/shared/port/repository/IReviewResultRepository";
import type { ICheckListItemRepository } from "@/application/shared/port/repository/ICheckListItemRepository";
import type { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import type { IProjectRepository } from "@/application/shared/port/repository";
import { ReviewSpace } from "@/domain/reviewSpace";
import { Project } from "@/domain/project";
import { CheckListItem } from "@/domain/checkListItem";
import type { RawUploadFileMeta, FileBuffersMap } from "@/application/mastra";

// Mastraワークフローのモック
const mockStart = vi.fn();
const mockCreateRunAsync = vi.fn(() => ({
  start: mockStart,
}));
const mockGetWorkflow = vi.fn(() => ({
  createRunAsync: mockCreateRunAsync,
}));

vi.mock("@/application/mastra", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/application/mastra")>();
  return {
    ...original,
    mastra: {
      getWorkflow: () => mockGetWorkflow(),
    },
  };
});

describe("ExecuteReviewService", () => {
  // モックリポジトリ
  const mockReviewTargetRepository: IReviewTargetRepository = {
    findById: vi.fn(),
    findByReviewSpaceId: vi.fn(),
    countByReviewSpaceId: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };

  const mockReviewResultRepository: IReviewResultRepository = {
    findById: vi.fn(),
    findByReviewTargetId: vi.fn(),
    countByReviewTargetId: vi.fn(),
    save: vi.fn(),
    saveMany: vi.fn(),
    delete: vi.fn(),
    deleteByReviewTargetId: vi.fn(),
  };

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

  let service: ExecuteReviewService;

  // テスト用データ（有効なUUID v4形式）
  const testProjectId = "550e8400-e29b-41d4-a716-446655440001";
  const testReviewSpaceId = "550e8400-e29b-41d4-a716-446655440002";
  const testUserId = "550e8400-e29b-41d4-a716-446655440003";
  const testCheckListItemId1 = "550e8400-e29b-41d4-a716-446655440004";
  const testCheckListItemId2 = "550e8400-e29b-41d4-a716-446655440005";

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

  const testCheckListItems = [
    CheckListItem.reconstruct({
      id: testCheckListItemId1,
      reviewSpaceId: testReviewSpaceId,
      content: "チェック項目1",
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    CheckListItem.reconstruct({
      id: testCheckListItemId2,
      reviewSpaceId: testReviewSpaceId,
      content: "チェック項目2",
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  ];

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

  // ワークフロー成功時のモックレスポンス
  const createSuccessWorkflowResponse = () => ({
    status: "success",
    result: {
      status: "success",
      reviewResults: [
        {
          checkListItemContent: "チェック項目1",
          evaluation: "A",
          comment: "問題ありません",
          errorMessage: null,
        },
        {
          checkListItemContent: "チェック項目2",
          evaluation: "B",
          comment: "一部改善が必要",
          errorMessage: null,
        },
      ],
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ExecuteReviewService(
      mockReviewTargetRepository,
      mockReviewResultRepository,
      mockCheckListItemRepository,
      mockReviewSpaceRepository,
      mockProjectRepository,
    );
  });

  describe("正常系", () => {
    it("レビュー実行が成功し、ステータスがcompletedになる", async () => {
      // モックの設定
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(mockCheckListItemRepository.findByReviewSpaceId).mockResolvedValue(
        testCheckListItems,
      );
      mockStart.mockResolvedValue(createSuccessWorkflowResponse());

      const command: ExecuteReviewCommand = {
        reviewSpaceId: testReviewSpaceId,
        name: "テストレビュー",
        userId: testUserId,
        files: testFiles,
        fileBuffers: createTestFileBuffers(),
      };

      const result = await service.execute(command);

      expect(result.status).toBe("completed");
      expect(result.reviewTargetId).toBeTruthy();
      expect(result.reviewResults).toHaveLength(2);
      expect(result.reviewResults[0].evaluation).toBe("A");
      expect(result.reviewResults[1].evaluation).toBe("B");

      // レビュー対象が保存される（pending → reviewing → completed で3回）
      expect(mockReviewTargetRepository.save).toHaveBeenCalledTimes(3);
    });

    it("レビュー設定付きでレビュー実行が成功する", async () => {
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(mockCheckListItemRepository.findByReviewSpaceId).mockResolvedValue(
        testCheckListItems,
      );
      mockStart.mockResolvedValue(createSuccessWorkflowResponse());

      const command: ExecuteReviewCommand = {
        reviewSpaceId: testReviewSpaceId,
        name: "テストレビュー",
        userId: testUserId,
        files: testFiles,
        fileBuffers: createTestFileBuffers(),
        reviewSettings: {
          additionalInstructions: "セキュリティに注意",
          concurrentReviewItems: 2,
          commentFormat: "【理由】",
          evaluationCriteria: [
            { label: "A", description: "優良" },
            { label: "B", description: "良好" },
          ],
        },
      };

      const result = await service.execute(command);

      expect(result.status).toBe("completed");
    });
  });

  describe("異常系 - 入力バリデーション", () => {
    it("ファイルが空の場合エラーになる", async () => {
      const command: ExecuteReviewCommand = {
        reviewSpaceId: testReviewSpaceId,
        name: "テストレビュー",
        userId: testUserId,
        files: [],
        fileBuffers: new Map(),
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "REVIEW_EXECUTION_NO_FILES",
      });
    });

    it("チェックリスト項目が空の場合エラーになる", async () => {
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(mockCheckListItemRepository.findByReviewSpaceId).mockResolvedValue(
        [],
      );

      const command: ExecuteReviewCommand = {
        reviewSpaceId: testReviewSpaceId,
        name: "テストレビュー",
        userId: testUserId,
        files: testFiles,
        fileBuffers: createTestFileBuffers(),
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "REVIEW_EXECUTION_NO_CHECKLIST",
      });
    });
  });

  describe("異常系 - 権限確認", () => {
    it("レビュースペースが存在しない場合エラーになる", async () => {
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(null);

      const command: ExecuteReviewCommand = {
        reviewSpaceId: testReviewSpaceId,
        name: "テストレビュー",
        userId: testUserId,
        files: testFiles,
        fileBuffers: createTestFileBuffers(),
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

      const command: ExecuteReviewCommand = {
        reviewSpaceId: testReviewSpaceId,
        name: "テストレビュー",
        userId: testUserId,
        files: testFiles,
        fileBuffers: createTestFileBuffers(),
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
      const command: ExecuteReviewCommand = {
        reviewSpaceId: testReviewSpaceId,
        name: "テストレビュー",
        userId: nonMemberUserId,
        files: testFiles,
        fileBuffers: createTestFileBuffers(),
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "PROJECT_ACCESS_DENIED",
      });
    });
  });

  describe("異常系 - ワークフロー失敗", () => {
    it("ワークフローが失敗した場合、ステータスがerrorに更新される", async () => {
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(mockCheckListItemRepository.findByReviewSpaceId).mockResolvedValue(
        testCheckListItems,
      );
      mockStart.mockResolvedValue({
        status: "failed",
        result: {
          status: "failed",
          errorMessage: "AI処理に失敗しました",
        },
      });

      const command: ExecuteReviewCommand = {
        reviewSpaceId: testReviewSpaceId,
        name: "テストレビュー",
        userId: testUserId,
        files: testFiles,
        fileBuffers: createTestFileBuffers(),
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "REVIEW_EXECUTION_FAILED",
      });

      // pending → reviewing → error で3回保存
      expect(mockReviewTargetRepository.save).toHaveBeenCalledTimes(3);
    });

    it("ワークフロー結果が空の場合エラーになる", async () => {
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(mockCheckListItemRepository.findByReviewSpaceId).mockResolvedValue(
        testCheckListItems,
      );
      mockStart.mockResolvedValue({
        status: "success",
        result: {
          status: "success",
          reviewResults: [],
        },
      });

      const command: ExecuteReviewCommand = {
        reviewSpaceId: testReviewSpaceId,
        name: "テストレビュー",
        userId: testUserId,
        files: testFiles,
        fileBuffers: createTestFileBuffers(),
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "REVIEW_EXECUTION_FAILED",
      });
    });

    it("ワークフロー結果がundefinedの場合エラーになる", async () => {
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(mockCheckListItemRepository.findByReviewSpaceId).mockResolvedValue(
        testCheckListItems,
      );
      mockStart.mockResolvedValue({
        status: "success",
        result: undefined,
      });

      const command: ExecuteReviewCommand = {
        reviewSpaceId: testReviewSpaceId,
        name: "テストレビュー",
        userId: testUserId,
        files: testFiles,
        fileBuffers: createTestFileBuffers(),
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "REVIEW_EXECUTION_FAILED",
      });
    });
  });
});
