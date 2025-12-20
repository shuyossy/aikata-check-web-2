import {
  IProjectRepository,
  IUserRepository,
} from "@/application/shared/port/repository";
import { buildUserInfoMap } from "@/application/shared/util";
import { ProjectDto, ProjectId } from "@/domain/project";
import { domainValidationError } from "@/lib/server/error";

/**
 * プロジェクト更新コマンド（入力DTO）
 */
export interface UpdateProjectCommand {
  /** プロジェクトID */
  projectId: string;
  /** リクエストユーザID */
  userId: string;
  /** 管理者フラグ（管理者の場合はメンバーチェックをスキップ） */
  isAdmin?: boolean;
  /** プロジェクト名（更新する場合） */
  name?: string;
  /** プロジェクト説明（更新する場合） */
  description?: string | null;
  /** APIキー（更新する場合、平文） */
  apiKey?: string | null;
}

/**
 * プロジェクト更新サービス
 * プロジェクトの基本情報を更新する
 */
export class UpdateProjectService {
  constructor(
    private readonly projectRepository: IProjectRepository,
    private readonly userRepository: IUserRepository,
  ) {}

  /**
   * プロジェクト更新を実行
   * @param command 更新コマンド
   * @returns 更新後のプロジェクトDTO
   * @throws ドメインバリデーションエラー - プロジェクトが存在しない場合、またはアクセス権がない場合
   */
  async execute(command: UpdateProjectCommand): Promise<ProjectDto> {
    const { projectId, userId, isAdmin, name, description, apiKey } = command;

    // プロジェクトを取得
    let project = await this.projectRepository.findById(
      ProjectId.reconstruct(projectId),
    );

    if (!project) {
      throw domainValidationError("PROJECT_NOT_FOUND");
    }

    // アクセス権の確認（管理者またはメンバーのみ編集可能）
    if (!isAdmin && !project.hasMember(userId)) {
      throw domainValidationError("PROJECT_ACCESS_DENIED");
    }

    // 各フィールドを更新
    if (name !== undefined) {
      project = project.updateName(name);
    }

    if (description !== undefined) {
      project = project.updateDescription(description);
    }

    if (apiKey !== undefined) {
      project = project.updateApiKey(apiKey);
    }

    // 保存
    await this.projectRepository.save(project);

    // メンバーのユーザー情報を取得
    const userIds = project.members.map((m) => m.userId);
    const users = await this.userRepository.findByIds(userIds);

    // ユーザー情報マップを作成
    const userInfoMap = buildUserInfoMap(users);

    return project.toDto(userInfoMap);
  }
}
