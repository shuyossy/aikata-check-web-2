import {
  IProjectRepository,
  IUserRepository,
} from "@/application/shared/port/repository";
import { buildUserInfoMap } from "@/application/shared/util";
import { ProjectDto, ProjectId } from "@/domain/project";
import { UserId } from "@/domain/user";
import { domainValidationError } from "@/lib/server/error";

/**
 * プロジェクトメンバー更新コマンド（入力DTO）
 */
export interface UpdateProjectMembersCommand {
  /** プロジェクトID */
  projectId: string;
  /** リクエストユーザID */
  userId: string;
  /** メンバーのユーザID一覧 */
  memberIds: string[];
}

/**
 * プロジェクトメンバー更新サービス
 * プロジェクトのメンバーリストを同期する
 */
export class UpdateProjectMembersService {
  constructor(
    private readonly projectRepository: IProjectRepository,
    private readonly userRepository: IUserRepository,
  ) {}

  /**
   * プロジェクトメンバー更新を実行
   * @param command 更新コマンド
   * @returns 更新後のプロジェクトDTO
   * @throws ドメインバリデーションエラー - プロジェクトが存在しない場合、アクセス権がない場合、またはメンバーが空の場合
   */
  async execute(command: UpdateProjectMembersCommand): Promise<ProjectDto> {
    const { projectId, userId, memberIds } = command;

    // プロジェクトを取得
    let project = await this.projectRepository.findById(
      ProjectId.reconstruct(projectId),
    );

    if (!project) {
      throw domainValidationError("PROJECT_NOT_FOUND");
    }

    // アクセス権の確認（メンバーのみ編集可能）
    if (!project.hasMember(userId)) {
      throw domainValidationError("PROJECT_ACCESS_DENIED");
    }

    // メンバーを同期
    project = project.syncMembers(memberIds);

    // 保存
    await this.projectRepository.save(project);

    // メンバーのユーザー情報を取得
    const userIds = memberIds.map((id) => UserId.reconstruct(id));
    const users = await this.userRepository.findByIds(userIds);

    // ユーザー情報マップを作成
    const userInfoMap = buildUserInfoMap(users);

    return project.toDto(userInfoMap);
  }
}
