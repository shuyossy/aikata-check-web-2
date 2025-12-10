import { IUserRepository } from "@/application/shared/port/repository";
import { User, UserDto, EmployeeId } from "@/domain/user";

/**
 * ユーザ同期コマンド（入力DTO）
 */
export interface SyncUserCommand {
  /** Keycloakから取得した社員ID（preferred_username） */
  employeeId: string;
  /** Keycloakから取得した表示名（display_name） */
  displayName: string;
}

/**
 * ユーザ同期サービス
 * Keycloak認証後にユーザをDBと同期する
 * - 新規ユーザの場合は作成
 * - 既存ユーザの場合は表示名を更新（変更がある場合のみ）
 */
export class SyncUserService {
  constructor(private readonly userRepository: IUserRepository) {}

  /**
   * ユーザ同期を実行
   * @param command 同期コマンド
   * @returns ユーザDTO
   * @throws ドメインバリデーションエラー - 社員IDまたは表示名が不正な場合
   */
  async execute(command: SyncUserCommand): Promise<UserDto> {
    const { employeeId, displayName } = command;

    // 社員IDの値オブジェクト生成（バリデーション含む）
    const employeeIdVo = EmployeeId.create(employeeId);

    // 既存ユーザの検索
    const existingUser =
      await this.userRepository.findByEmployeeId(employeeIdVo);

    if (existingUser) {
      // 既存ユーザの場合：表示名が変わっていれば更新
      if (existingUser.hasDisplayNameChanged(displayName)) {
        const updatedUser = existingUser.updateDisplayName(displayName);
        await this.userRepository.save(updatedUser);
        return updatedUser.toDto();
      }
      // 表示名が同じ場合は更新不要
      return existingUser.toDto();
    }

    // 新規ユーザの場合：作成して保存
    const newUser = User.create({
      employeeId,
      displayName,
    });
    await this.userRepository.save(newUser);

    return newUser.toDto();
  }
}
