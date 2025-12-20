import { IUserRepository } from "@/application/shared/port/repository";
import { UserId, UserDto } from "@/domain/user";
import { domainValidationError } from "@/lib/server/error";

/**
 * 管理者権限付与コマンド
 */
export interface GrantAdminCommand {
  /** 管理者権限を付与するユーザID */
  targetUserId: string;
}

/**
 * 管理者権限付与サービス
 * 指定したユーザに管理者権限を付与する
 */
export class GrantAdminService {
  constructor(private readonly userRepository: IUserRepository) {}

  /**
   * 管理者権限を付与する
   * @param command 管理者権限付与コマンド
   * @returns 更新されたユーザDTO
   * @throws ドメインバリデーションエラー - ユーザが存在しない場合、既に管理者の場合
   */
  async execute(command: GrantAdminCommand): Promise<UserDto> {
    const { targetUserId } = command;

    // 対象ユーザを取得
    const userIdVo = UserId.reconstruct(targetUserId);
    const user = await this.userRepository.findById(userIdVo);

    if (!user) {
      throw domainValidationError("ADMIN_NOT_FOUND");
    }

    // 既に管理者の場合はエラー
    if (user.isAdmin) {
      throw domainValidationError("ADMIN_ALREADY_EXISTS");
    }

    // 管理者権限を付与
    const updatedUser = user.updateAdminStatus(true);
    await this.userRepository.save(updatedUser);

    return updatedUser.toDto();
  }
}
