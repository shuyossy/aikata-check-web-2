import { ICheckListItemRepository } from "@/application/shared/port/repository/ICheckListItemRepository";
import { IProjectRepository } from "@/application/shared/port/repository";
import { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import { CheckListItemId } from "@/domain/checkListItem";
import { ProjectId } from "@/domain/project";
import { ReviewSpaceId } from "@/domain/reviewSpace";
import { domainValidationError } from "@/lib/server/error";

/**
 * チェック項目一括削除コマンド（入力DTO）
 */
export interface BulkDeleteCheckListItemsCommand {
  /** レビュースペースID */
  reviewSpaceId: string;
  /** 実行ユーザーID（権限確認用） */
  userId: string;
  /** 削除するチェック項目IDの配列 */
  checkListItemIds: string[];
}

/**
 * チェック項目一括削除結果DTO
 */
export interface BulkDeleteCheckListItemsResult {
  /** 削除された件数 */
  deletedCount: number;
}

/**
 * チェック項目一括削除サービス
 * 指定されたチェック項目を一括で削除する
 */
export class BulkDeleteCheckListItemsService {
  constructor(
    private readonly checkListItemRepository: ICheckListItemRepository,
    private readonly reviewSpaceRepository: IReviewSpaceRepository,
    private readonly projectRepository: IProjectRepository,
  ) {}

  /**
   * チェック項目一括削除を実行
   * @param command 削除コマンド
   * @returns 削除結果
   */
  async execute(
    command: BulkDeleteCheckListItemsCommand,
  ): Promise<BulkDeleteCheckListItemsResult> {
    const { reviewSpaceId, userId, checkListItemIds } = command;

    // 空配列の場合は即座に成功を返す
    if (checkListItemIds.length === 0) {
      return { deletedCount: 0 };
    }

    // レビュースペースの存在確認
    const reviewSpaceIdVo = ReviewSpaceId.reconstruct(reviewSpaceId);
    const reviewSpace =
      await this.reviewSpaceRepository.findById(reviewSpaceIdVo);
    if (!reviewSpace) {
      throw domainValidationError("REVIEW_SPACE_NOT_FOUND");
    }

    // プロジェクトの存在確認
    const projectId = ProjectId.reconstruct(reviewSpace.projectId.value);
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw domainValidationError("PROJECT_NOT_FOUND");
    }

    // プロジェクトへのアクセス権確認
    if (!project.hasMember(userId)) {
      throw domainValidationError("PROJECT_ACCESS_DENIED");
    }

    // チェック項目IDを値オブジェクトに変換
    const itemIds = checkListItemIds.map((id) =>
      CheckListItemId.reconstruct(id),
    );

    // 一括でチェック項目を取得（N+1問題を回避）
    const items = await this.checkListItemRepository.findByIds(itemIds);

    // 全てのチェック項目が存在するか確認
    if (items.length !== itemIds.length) {
      throw domainValidationError("CHECK_LIST_ITEM_NOT_FOUND");
    }

    // 全てのチェック項目が指定されたレビュースペースに所属しているか確認
    for (const item of items) {
      if (!item.reviewSpaceId.equals(reviewSpaceIdVo)) {
        throw domainValidationError("REVIEW_SPACE_ACCESS_DENIED");
      }
    }

    // 一括削除を実行
    await this.checkListItemRepository.deleteMany(itemIds);

    return {
      deletedCount: itemIds.length,
    };
  }
}
