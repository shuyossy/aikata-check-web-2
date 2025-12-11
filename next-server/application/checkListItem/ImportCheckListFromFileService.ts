import { ICheckListItemRepository } from "@/application/shared/port/repository/ICheckListItemRepository";
import { IProjectRepository } from "@/application/shared/port/repository";
import { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import type { IFileTextExtractor } from "@/application/shared/port/textExtractor";
import { CheckListItem } from "@/domain/checkListItem";
import { ProjectId } from "@/domain/project";
import { ReviewSpaceId } from "@/domain/reviewSpace";
import { domainValidationError, internalError } from "@/lib/server/error";
import { CsvParser } from "@/lib/shared/CsvParser";
import path from "path";

/**
 * チェックリストファイルインポートコマンド（入力DTO）
 */
export interface ImportCheckListFromFileCommand {
  /** レビュースペースID */
  reviewSpaceId: string;
  /** 実行ユーザーID（権限確認用） */
  userId: string;
  /** ファイルのバイナリデータ */
  fileBuffer: Buffer;
  /** ファイル名（拡張子の判定に使用） */
  fileName: string;
  /** オプション設定 */
  options?: ImportCheckListFromFileOptions;
}

/**
 * インポートオプション
 */
export interface ImportCheckListFromFileOptions {
  /** ヘッダー行をスキップするか（デフォルト: false） */
  skipHeaderRow?: boolean;
}

/**
 * チェックリストファイルインポート結果DTO
 */
export interface ImportCheckListFromFileResult {
  /** インポートされた件数 */
  importedCount: number;
  /** ファイル形式 */
  fileType: string;
}

/**
 * チェックリストファイルインポートサービス
 * ファイルからチェックリストを抽出し、レビュースペースに保存する
 */
export class ImportCheckListFromFileService {
  constructor(
    private readonly fileTextExtractor: IFileTextExtractor,
    private readonly checkListItemRepository: ICheckListItemRepository,
    private readonly reviewSpaceRepository: IReviewSpaceRepository,
    private readonly projectRepository: IProjectRepository,
  ) {}

  /**
   * チェックリストファイルインポートを実行
   * @param command インポートコマンド
   * @returns インポート結果
   */
  async execute(
    command: ImportCheckListFromFileCommand,
  ): Promise<ImportCheckListFromFileResult> {
    const { reviewSpaceId, userId, fileBuffer, fileName, options } = command;

    // ファイル拡張子の取得
    const extension = path.extname(fileName).toLowerCase();

    // サポートされているファイル形式かチェック
    if (!this.fileTextExtractor.isSupported(extension)) {
      throw internalError({
        expose: true,
        messageCode: "CHECK_LIST_FILE_IMPORT_UNSUPPORTED_FORMAT",
      });
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

    // 1. ファイルからテキストを抽出（汎用処理）
    let extractedText: string;
    try {
      extractedText = await this.fileTextExtractor.extract(
        fileBuffer,
        fileName,
        { normalize: true },
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      throw internalError({
        expose: true,
        messageCode: "CHECK_LIST_FILE_IMPORT_PARSE_ERROR",
        messageParams: { detail: message },
      });
    }

    // 2. テキストからチェックリスト項目を抽出（チェックリスト固有処理）
    const fileType = this.getFileType(extension);
    const contents = this.parseCheckListItems(extractedText, fileType, {
      skipHeaderRow: options?.skipHeaderRow ?? false,
    });

    // 抽出された項目が0件の場合はエラー
    if (contents.length === 0) {
      throw internalError({
        expose: true,
        messageCode: "CHECK_LIST_FILE_IMPORT_NO_ITEMS",
      });
    }

    // チェック項目エンティティを生成
    const items = contents.map((content) =>
      CheckListItem.create({
        reviewSpaceId,
        content,
      }),
    );

    // 一括追加を実行（既存のチェック項目に追加）
    await this.checkListItemRepository.bulkInsert(items);

    return {
      importedCount: items.length,
      fileType,
    };
  }

  /**
   * 拡張子からファイル形式名を取得
   */
  private getFileType(extension: string): string {
    switch (extension) {
      case ".csv":
        return "csv";
      case ".xlsx":
      case ".xls":
        return "xlsx";
      default:
        return "unknown";
    }
  }

  /**
   * テキストからチェックリスト項目を抽出
   * @param text 抽出元テキスト
   * @param fileType ファイル形式
   * @param options パースオプション
   * @returns チェック項目の配列（空行は常に除外）
   */
  private parseCheckListItems(
    text: string,
    fileType: string,
    options: { skipHeaderRow: boolean },
  ): string[] {
    switch (fileType) {
      case "csv":
        return this.parseCsvItems(text, options);
      case "xlsx":
        return this.parseXlsxItems(text, options);
      default:
        return this.parseCsvItems(text, options);
    }
  }

  /**
   * テキストファイルからチェック項目を抽出
   * 各行を1項目として抽出（空行は除外）
   */
  private parseTxtItems(
    text: string,
    options: { skipHeaderRow: boolean },
  ): string[] {
    const lines = text.split(/\r\n|\r|\n/);
    const startIndex = options.skipHeaderRow ? 1 : 0;
    return lines
      .slice(startIndex)
      .map((line) => line.trim())
      .filter((line) => line !== "");
  }

  /**
   * CSVファイルからチェック項目を抽出
   * 1列目を項目として抽出（空行は除外）
   */
  private parseCsvItems(
    text: string,
    options: { skipHeaderRow: boolean },
  ): string[] {
    const rows = CsvParser.parse(text);
    const startIndex = options.skipHeaderRow ? 1 : 0;
    return rows
      .slice(startIndex)
      .map((row) => row[0]?.trim() ?? "")
      .filter((cell) => cell !== "");
  }

  /**
   * Excelファイルからチェック項目を抽出
   * #sheet:シート名 で分割し、各シートの1列目を抽出（空行は除外）
   */
  private parseXlsxItems(
    text: string,
    options: { skipHeaderRow: boolean },
  ): string[] {
    const items: string[] = [];
    // #sheet: でシートを分割（最初の空文字を除外）
    const sheets = text.split(/^#sheet:/m).filter((s) => s.trim());

    for (const sheetContent of sheets) {
      // 最初の行はシート名なのでスキップ
      const lines = sheetContent.split("\n");
      const csvLines = lines.slice(1).join("\n");

      // 空のシートはスキップ
      if (!csvLines.trim()) continue;

      const rows = CsvParser.parse(csvLines);
      const startIndex = options.skipHeaderRow ? 1 : 0;

      for (const row of rows.slice(startIndex)) {
        const cell = row[0]?.trim() ?? "";
        if (cell !== "") {
          items.push(cell);
        }
      }
    }

    return items;
  }
}
