import { ICheckListItemRepository } from "@/application/shared/port/repository/ICheckListItemRepository";
import { IProjectRepository } from "@/application/shared/port/repository";
import { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import { CheckListItem } from "@/domain/checkListItem";
import { ProjectId } from "@/domain/project";
import { ReviewSpaceId } from "@/domain/reviewSpace";
import { domainValidationError, internalError } from "@/lib/server/error";
import { CsvParser } from "@/lib/shared/CsvParser";

/**
 * チェックリストCSV出力コマンド（入力DTO）
 */
export interface ExportCheckListToCsvCommand {
  /** レビュースペースID */
  reviewSpaceId: string;
  /** 実行ユーザーID（権限確認用） */
  userId: string;
}

/**
 * チェックリストCSV出力結果DTO
 */
export interface ExportCheckListToCsvResult {
  /** CSVコンテンツ（UTF-8 with BOM） */
  csvContent: string;
  /** 出力された件数 */
  exportedCount: number;
}

/**
 * チェックリストCSV出力サービス
 * レビュースペース配下のチェック項目をCSV形式で出力する
 */
export class ExportCheckListToCsvService {
  // UTF-8 BOM（Excelで正しく開けるように）
  private static readonly UTF8_BOM = "\uFEFF";
  // 取得上限（メモリ保護）
  private static readonly MAX_ITEMS = 10000;

  constructor(
    private readonly checkListItemRepository: ICheckListItemRepository,
    private readonly reviewSpaceRepository: IReviewSpaceRepository,
    private readonly projectRepository: IProjectRepository,
  ) {}

  /**
   * チェックリストCSV出力を実行
   * @param command 出力コマンド
   * @returns CSV出力結果
   */
  async execute(
    command: ExportCheckListToCsvCommand,
  ): Promise<ExportCheckListToCsvResult> {
    const { reviewSpaceId, userId } = command;

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

    // チェック項目数を確認
    const count =
      await this.checkListItemRepository.countByReviewSpaceId(reviewSpaceIdVo);

    if (count === 0) {
      throw internalError({
        expose: true,
        messageCode: "CHECK_LIST_EXPORT_NO_ITEMS",
      });
    }

    if (count > ExportCheckListToCsvService.MAX_ITEMS) {
      throw internalError({
        expose: true,
        messageCode: "CHECK_LIST_EXPORT_TOO_MANY_ITEMS",
        messageParams: {
          maxItems: ExportCheckListToCsvService.MAX_ITEMS.toString(),
        },
      });
    }

    // チェック項目一覧を取得
    const items = await this.checkListItemRepository.findByReviewSpaceId(
      reviewSpaceIdVo,
      {
        limit: ExportCheckListToCsvService.MAX_ITEMS,
      },
    );

    // CSV生成
    const csvContent = this.generateCsv(items);

    return {
      csvContent,
      exportedCount: items.length,
    };
  }

  /**
   * チェック項目リストからCSVコンテンツを生成
   * @param items チェック項目リスト
   * @returns UTF-8 BOM付きCSVコンテンツ
   */
  private generateCsv(items: CheckListItem[]): string {
    // 各項目をエスケープして改行で結合
    const lines = items.map((item) =>
      CsvParser.escapeField(item.content.value),
    );
    return ExportCheckListToCsvService.UTF8_BOM + lines.join("\n");
  }
}
