import {
  IProjectRepository,
  IUserRepository,
} from "@/application/shared/port/repository";
import { ProjectDto, ProjectId } from "@/domain/project";
import { UserId } from "@/domain/user";
import { domainValidationError } from "@/lib/server/error";

/**
 * プロジェクト取得クエリ（入力DTO）
 */
export interface GetProjectQuery {
  /** プロジェクトID */
  projectId: string;
  /** リクエストユーザID */
  userId: string;
}

/**
 * プロジェクト取得サービス
 * プロジェクトの詳細情報を取得する
 */
export class GetProjectService {
  constructor(
    private readonly projectRepository: IProjectRepository,
    private readonly userRepository: IUserRepository,
  ) {}

  /**
   * プロジェクト取得を実行
   * @param query 取得クエリ
   * @returns プロジェクトDTO
   * @throws ドメインバリデーションエラー - プロジェクトが存在しない場合、またはアクセス権がない場合
   */
  async execute(query: GetProjectQuery): Promise<ProjectDto> {
    const { projectId, userId } = query;

    // プロジェクトを取得
    const project = await this.projectRepository.findById(
      ProjectId.reconstruct(projectId),
    );

    if (!project) {
      throw domainValidationError("PROJECT_NOT_FOUND");
    }

    // アクセス権の確認（メンバーのみアクセス可能）
    if (!project.hasMember(userId)) {
      throw domainValidationError("PROJECT_ACCESS_DENIED");
    }

    // メンバーのユーザー情報を取得
    const userIds = project.members.map((m) => m.userId);
    const users = await this.userRepository.findByIds(userIds);

    // ユーザー名マップを作成
    const userNameMap = new Map<string, string>();
    for (const user of users) {
      userNameMap.set(user.id.value, user.displayName);
    }

    return project.toDto(userNameMap);
  }
}
