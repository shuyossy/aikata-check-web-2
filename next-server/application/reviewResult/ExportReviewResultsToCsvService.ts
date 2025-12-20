import { IReviewResultRepository } from "@/application/shared/port/repository/IReviewResultRepository";
import { IReviewTargetRepository } from "@/application/shared/port/repository/IReviewTargetRepository";
import { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import { IProjectRepository } from "@/application/shared/port/repository";
import { ReviewResult } from "@/domain/reviewResult";
import { ProjectId } from "@/domain/project";
import { ReviewSpaceId } from "@/domain/reviewSpace";
import { ReviewTargetId } from "@/domain/reviewTarget";
import { domainValidationError, internalError } from "@/lib/server/error";
import { CsvParser } from "@/lib/shared/CsvParser";

/**
 * レビュー結果CSV出力コマンド（入力DTO）
 */
export interface ExportReviewResultsToCsvCommand {
  /** レビュー対象ID */
  reviewTargetId: string;
  /** 実行ユーザーID（権限確認用） */
  userId: string;
}

/**
 * レビュー結果CSV出力結果DTO
 */
export interface ExportReviewResultsToCsvResult {
  /** CSVコンテンツ（UTF-8 with BOM） */
  csvContent: string;
  /** 出力された件数 */
  exportedCount: number;
}

/**
 * レビュー結果CSV出力サービス
 * レビュー対象配下のレビュー結果をCSV形式で出力する
 */
export class ExportReviewResultsToCsvService {
  // UTF-8 BOM（Excelで正しく開けるように）
  private static readonly UTF8_BOM = "\uFEFF";
  // 取得上限（メモリ保護）
  private static readonly MAX_ITEMS = 10000;

  constructor(
    private readonly reviewResultRepository: IReviewResultRepository,
    private readonly reviewTargetRepository: IReviewTargetRepository,
    private readonly reviewSpaceRepository: IReviewSpaceRepository,
    private readonly projectRepository: IProjectRepository,
  ) {}

  /**
   * レビュー結果CSV出力を実行
   * @param command 出力コマンド
   * @returns CSV出力結果
   */
  async execute(
    command: ExportReviewResultsToCsvCommand,
  ): Promise<ExportReviewResultsToCsvResult> {
    const { reviewTargetId, userId } = command;

    // レビュー対象の存在確認
    const reviewTargetIdVo = ReviewTargetId.reconstruct(reviewTargetId);
    const reviewTarget =
      await this.reviewTargetRepository.findById(reviewTargetIdVo);
    if (!reviewTarget) {
      throw domainValidationError("REVIEW_TARGET_NOT_FOUND");
    }

    // レビュースペースの存在確認
    const reviewSpaceId = ReviewSpaceId.reconstruct(
      reviewTarget.reviewSpaceId.value,
    );
    const reviewSpace =
      await this.reviewSpaceRepository.findById(reviewSpaceId);
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

    // レビュー結果数を確認
    const count =
      await this.reviewResultRepository.countByReviewTargetId(reviewTargetIdVo);

    if (count === 0) {
      throw internalError({
        expose: true,
        messageCode: "REVIEW_RESULT_EXPORT_NO_ITEMS",
      });
    }

    if (count > ExportReviewResultsToCsvService.MAX_ITEMS) {
      throw internalError({
        expose: true,
        messageCode: "REVIEW_RESULT_EXPORT_TOO_MANY_ITEMS",
        messageParams: {
          maxItems: ExportReviewResultsToCsvService.MAX_ITEMS.toString(),
        },
      });
    }

    // レビュー結果一覧を取得
    const results =
      await this.reviewResultRepository.findByReviewTargetId(reviewTargetIdVo);

    // CSV生成
    const csvContent = this.generateCsv(results);

    return {
      csvContent,
      exportedCount: results.length,
    };
  }

  /**
   * レビュー結果リストからCSVコンテンツを生成
   * @param results レビュー結果リスト
   * @returns UTF-8 BOM付きCSVコンテンツ
   */
  private generateCsv(results: ReviewResult[]): string {
    // ヘッダー行
    const header = ["チェック項目", "評定", "コメント"];
    const rows: string[][] = [header];

    // データ行
    for (const result of results) {
      if (result.isError()) {
        // エラーの場合は評定を「エラー」、コメントをエラーメッセージにする
        rows.push([
          result.checkListItemContent,
          "エラー",
          result.errorMessage || "",
        ]);
      } else {
        rows.push([
          result.checkListItemContent,
          result.evaluation.value || "",
          result.comment.value || "",
        ]);
      }
    }

    // 各セルをエスケープしてCSV形式に変換
    const csvLines = rows.map((row) =>
      row.map((cell) => CsvParser.escapeField(cell)).join(","),
    );

    return ExportReviewResultsToCsvService.UTF8_BOM + csvLines.join("\n");
  }
}
