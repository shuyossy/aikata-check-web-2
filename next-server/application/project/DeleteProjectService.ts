import { IProjectRepository } from "@/application/shared/port/repository";
import { ProjectId } from "@/domain/project";
import { domainValidationError } from "@/lib/server/error";

/**
 * プロジェクト削除コマンド（入力DTO）
 */
export interface DeleteProjectCommand {
  /** プロジェクトID */
  projectId: string;
  /** リクエストユーザID */
  userId: string;
}

/**
 * プロジェクト削除サービス
 * プロジェクトを削除する（メンバーであれば誰でも削除可能）
 */
export class DeleteProjectService {
  constructor(private readonly projectRepository: IProjectRepository) {}

  /**
   * プロジェクト削除を実行
   * @param command 削除コマンド
   * @throws ドメインバリデーションエラー - プロジェクトが存在しない場合、またはアクセス権がない場合
   */
  async execute(command: DeleteProjectCommand): Promise<void> {
    const { projectId, userId } = command;

    const projectIdVo = ProjectId.reconstruct(projectId);

    // プロジェクトを取得
    const project = await this.projectRepository.findById(projectIdVo);

    if (!project) {
      throw domainValidationError("PROJECT_NOT_FOUND");
    }

    // アクセス権の確認（メンバーのみ削除可能）
    if (!project.hasMember(userId)) {
      throw domainValidationError("PROJECT_ACCESS_DENIED");
    }

    // 削除
    await this.projectRepository.delete(projectIdVo);
  }
}
