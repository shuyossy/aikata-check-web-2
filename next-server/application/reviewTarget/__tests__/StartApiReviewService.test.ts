import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  StartApiReviewService,
  type StartApiReviewCommand,
} from "../StartApiReviewService";
import type { IReviewTargetRepository } from "@/application/shared/port/repository/IReviewTargetRepository";
import type { ICheckListItemRepository } from "@/application/shared/port/repository/ICheckListItemRepository";
import type { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import type { IProjectRepository } from "@/application/shared/port/repository";
import { ReviewSpace } from "@/domain/reviewSpace";
import { Project } from "@/domain/project";
import { CheckListItem } from "@/domain/checkListItem";
import { ReviewTarget } from "@/domain/reviewTarget";

describe("StartApiReviewService", () => {
  // モックリポジトリ
  const mockReviewTargetRepository: IReviewTargetRepository = {
    findById: vi.fn(),
    findByReviewSpaceId: vi.fn(),
    countByReviewSpaceId: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
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

  let service: StartApiReviewService;

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

  beforeEach(() => {
    vi.clearAllMocks();
    service = new StartApiReviewService(
      mockReviewTargetRepository,
      mockCheckListItemRepository,
      mockReviewSpaceRepository,
      mockProjectRepository,
    );
  });

  describe("正常系", () => {
    it("外部APIレビューを開始し、reviewType=apiのReviewTargetが作成される", async () => {
      // モックの設定
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(mockCheckListItemRepository.findByReviewSpaceId).mockResolvedValue(
        testCheckListItems,
      );

      const command: StartApiReviewCommand = {
        reviewSpaceId: testReviewSpaceId,
        name: "テスト外部APIレビュー",
        userId: testUserId,
      };

      const result = await service.execute(command);

      // 結果の検証
      expect(result.reviewTargetId).toBeTruthy();
      expect(result.checkListItems).toHaveLength(2);
      expect(result.checkListItems[0].id).toBe(testCheckListItemId1);
      expect(result.checkListItems[0].content).toBe("チェック項目1");
      expect(result.checkListItems[1].id).toBe(testCheckListItemId2);
      expect(result.checkListItems[1].content).toBe("チェック項目2");
      expect(result.concurrentReviewItems).toBe(10); // デフォルト値

      // レビュー対象が1回だけ保存される（reviewingステータスで即保存）
      expect(mockReviewTargetRepository.save).toHaveBeenCalledTimes(1);

      // 保存されたReviewTargetがreviewType=apiかつreviewingステータスであることを確認
      const savedTarget = vi.mocked(mockReviewTargetRepository.save).mock.calls[0][0] as ReviewTarget;
      expect(savedTarget.reviewType?.isApi()).toBe(true);
      expect(savedTarget.status.isReviewing()).toBe(true);
    });

    it("レビュー設定付きで外部APIレビューを開始できる", async () => {
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(mockCheckListItemRepository.findByReviewSpaceId).mockResolvedValue(
        testCheckListItems,
      );

      const command: StartApiReviewCommand = {
        reviewSpaceId: testReviewSpaceId,
        name: "テスト外部APIレビュー",
        userId: testUserId,
        reviewSettings: {
          additionalInstructions: "セキュリティに注意",
          concurrentReviewItems: 5,
          commentFormat: "【理由】",
          evaluationCriteria: [
            { label: "A", description: "優良" },
            { label: "B", description: "良好" },
          ],
        },
      };

      const result = await service.execute(command);

      expect(result.concurrentReviewItems).toBe(5);
      expect(result.checkListItems).toHaveLength(2);
    });

    it("reviewSettingsがnullの場合、デフォルト設定でレビュー対象が作成される", async () => {
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(mockCheckListItemRepository.findByReviewSpaceId).mockResolvedValue(
        testCheckListItems,
      );

      const command: StartApiReviewCommand = {
        reviewSpaceId: testReviewSpaceId,
        name: "テスト外部APIレビュー",
        userId: testUserId,
        // reviewSettingsを指定しない
      };

      const result = await service.execute(command);

      // デフォルトの同時レビュー項目数が10であることを確認
      expect(result.concurrentReviewItems).toBe(10);

      // 保存されたReviewTargetのreviewSettingsがnullであることを確認
      const savedTarget = vi.mocked(mockReviewTargetRepository.save).mock.calls[0][0] as ReviewTarget;
      expect(savedTarget.reviewSettings).toBeNull();
    });
  });

  describe("異常系 - 権限確認", () => {
    it("レビュースペースが存在しない場合エラーになる", async () => {
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(null);

      const command: StartApiReviewCommand = {
        reviewSpaceId: testReviewSpaceId,
        name: "テスト外部APIレビュー",
        userId: testUserId,
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

      const command: StartApiReviewCommand = {
        reviewSpaceId: testReviewSpaceId,
        name: "テスト外部APIレビュー",
        userId: testUserId,
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

      // メンバーではないユーザーID
      const nonMemberUserId = "550e8400-e29b-41d4-a716-446655440099";
      const command: StartApiReviewCommand = {
        reviewSpaceId: testReviewSpaceId,
        name: "テスト外部APIレビュー",
        userId: nonMemberUserId,
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "PROJECT_ACCESS_DENIED",
      });
    });
  });

  describe("異常系 - チェックリスト確認", () => {
    it("チェックリスト項目が空の場合エラーになる", async () => {
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(mockCheckListItemRepository.findByReviewSpaceId).mockResolvedValue(
        [],
      );

      const command: StartApiReviewCommand = {
        reviewSpaceId: testReviewSpaceId,
        name: "テスト外部APIレビュー",
        userId: testUserId,
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "REVIEW_EXECUTION_NO_CHECKLIST",
      });
    });
  });
});
