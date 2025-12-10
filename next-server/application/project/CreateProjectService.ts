import {
  IProjectRepository,
  IUserRepository,
} from "@/application/shared/port/repository";
import { Project, ProjectDto } from "@/domain/project";
import { UserId } from "@/domain/user";
import { domainValidationError } from "@/lib/server/error";

/**
 * プロジェクト作成コマンド（入力DTO）
 */
export interface CreateProjectCommand {
  /** プロジェクト名 */
  name: string;
  /** プロジェクト説明 */
  description?: string | null;
  /** APIキー（平文） */
  apiKey?: string | null;
  /** メンバーのユーザID一覧（作成者含む） */
  memberIds: string[];
}

/**
 * プロジェクト作成サービス
 * 新規プロジェクトを作成する
 */
export class CreateProjectService {
  constructor(
    private readonly projectRepository: IProjectRepository,
    private readonly userRepository: IUserRepository,
  ) {}

  /**
   * プロジェクト作成を実行
   * @param command 作成コマンド
   * @returns プロジェクトDTO
   * @throws ドメインバリデーションエラー - 入力が不正な場合
   */
  async execute(command: CreateProjectCommand): Promise<ProjectDto> {
    const { name, description, apiKey, memberIds } = command;

    // メンバーのユーザー情報を取得（存在確認）
    const userIds = memberIds.map((id) => UserId.reconstruct(id));
    const users = await this.userRepository.findByIds(userIds);

    // すべてのメンバーが存在するか検証
    if (users.length !== memberIds.length) {
      throw domainValidationError("PROJECT_MEMBER_USER_NOT_FOUND");
    }

    // プロジェクトを作成
    const project = Project.create({
      name,
      description,
      apiKey,
      memberIds,
    });

    // 保存
    await this.projectRepository.save(project);

    // ユーザー名マップを作成（既に取得済み）
    const userNameMap = new Map<string, string>();
    for (const user of users) {
      userNameMap.set(user.id.value, user.displayName);
    }

    return project.toDto(userNameMap);
  }
}
