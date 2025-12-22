import { IProjectRepository } from "@/application/shared/port/repository";
import { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import { ProjectId } from "@/domain/project";
import {
  ReviewSpace,
  ReviewSpaceDto,
  ReviewSettingsProps,
} from "@/domain/reviewSpace";
import { domainValidationError } from "@/lib/server/error";

/**
 * レビュースペース作成コマンド（入力DTO）
 */
export interface CreateReviewSpaceCommand {
  /** プロジェクトID */
  projectId: string;
  /** スペース名 */
  name: string;
  /** スペース説明 */
  description?: string | null;
  /** 実行ユーザーID（権限確認用） */
  userId: string;
  /** デフォルトのレビュー設定 */
  defaultReviewSettings?: ReviewSettingsProps | null;
}

/**
 * レビュースペース作成サービス
 * 新規レビュースペースを作成する
 */
export class CreateReviewSpaceService {
  constructor(
    private readonly reviewSpaceRepository: IReviewSpaceRepository,
    private readonly projectRepository: IProjectRepository,
  ) {}

  /**
   * レビュースペース作成を実行
   * @param command 作成コマンド
   * @returns レビュースペースDTO
   * @throws ドメインバリデーションエラー - 入力が不正な場合
   */
  async execute(command: CreateReviewSpaceCommand): Promise<ReviewSpaceDto> {
    const { projectId, name, description, userId, defaultReviewSettings } =
      command;

    // プロジェクトの存在確認
    const projectIdVo = ProjectId.reconstruct(projectId);
    const project = await this.projectRepository.findById(projectIdVo);
    if (!project) {
      throw domainValidationError("PROJECT_NOT_FOUND");
    }

    // プロジェクトへのアクセス権確認
    if (!project.hasMember(userId)) {
      throw domainValidationError("PROJECT_ACCESS_DENIED");
    }

    // レビュースペースを作成
    const reviewSpace = ReviewSpace.create({
      projectId,
      name,
      description,
      defaultReviewSettings,
    });

    // 保存
    await this.reviewSpaceRepository.save(reviewSpace);

    return reviewSpace.toDto();
  }
}
