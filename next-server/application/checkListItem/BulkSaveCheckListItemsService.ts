import { ICheckListItemRepository } from "@/application/shared/port/repository/ICheckListItemRepository";
import { IProjectRepository } from "@/application/shared/port/repository";
import { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import { CheckListItem } from "@/domain/checkListItem";
import { ProjectId } from "@/domain/project";
import { ReviewSpaceId } from "@/domain/reviewSpace";
import { domainValidationError } from "@/lib/server/error";

/**
 * チェック項目一括保存コマンド（入力DTO）
 */
export interface BulkSaveCheckListItemsCommand {
  /** レビュースペースID */
  reviewSpaceId: string;
  /** 実行ユーザーID（権限確認用） */
  userId: string;
  /** チェック項目内容の配列 */
  contents: string[];
}

/**
 * チェック項目一括保存結果DTO
 */
export interface BulkSaveCheckListItemsResult {
  /** 保存された件数 */
  savedCount: number;
}

/**
 * チェック項目一括保存サービス
 * レビュースペースのチェック項目を全て置き換える
 */
export class BulkSaveCheckListItemsService {
  constructor(
    private readonly checkListItemRepository: ICheckListItemRepository,
    private readonly reviewSpaceRepository: IReviewSpaceRepository,
    private readonly projectRepository: IProjectRepository,
  ) {}

  /**
   * チェック項目一括保存を実行
   * @param command 保存コマンド
   * @returns 保存結果
   */
  async execute(
    command: BulkSaveCheckListItemsCommand,
  ): Promise<BulkSaveCheckListItemsResult> {
    const { reviewSpaceId, userId, contents } = command;

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

    // チェック項目エンティティを生成（バリデーションを含む）
    const items = contents.map((content) =>
      CheckListItem.create({
        reviewSpaceId,
        content,
      }),
    );

    // 一括保存を実行
    await this.checkListItemRepository.bulkSave(reviewSpaceIdVo, items);

    return {
      savedCount: items.length,
    };
  }
}
