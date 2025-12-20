import { IUserRepository } from "@/application/shared/port/repository";
import { UserId, UserDto } from "@/domain/user";
import { domainValidationError } from "@/lib/server/error";

/**
 * 管理者権限削除コマンド
 */
export interface RevokeAdminCommand {
  /** 管理者権限を削除するユーザID */
  targetUserId: string;
  /** 操作を実行するユーザID（自分自身の権限削除を防ぐため） */
  executorUserId: string;
}

/**
 * 管理者権限削除サービス
 * 指定したユーザから管理者権限を削除する
 */
export class RevokeAdminService {
  constructor(private readonly userRepository: IUserRepository) {}

  /**
   * 管理者権限を削除する
   * @param command 管理者権限削除コマンド
   * @returns 更新されたユーザDTO
   * @throws ドメインバリデーションエラー - ユーザが存在しない場合、管理者でない場合、自分自身の場合、最後の管理者の場合
   */
  async execute(command: RevokeAdminCommand): Promise<UserDto> {
    const { targetUserId, executorUserId } = command;

    // 自分自身の権限は削除できない
    if (targetUserId === executorUserId) {
      throw domainValidationError("ADMIN_CANNOT_REVOKE_SELF");
    }

    // 対象ユーザを取得
    const userIdVo = UserId.reconstruct(targetUserId);
    const user = await this.userRepository.findById(userIdVo);

    if (!user) {
      throw domainValidationError("ADMIN_NOT_FOUND");
    }

    // 管理者でない場合はエラー
    if (!user.isAdmin) {
      throw domainValidationError("ADMIN_NOT_FOUND");
    }

    // 最後の管理者は削除できない
    const adminCount = await this.userRepository.countAdmins();
    if (adminCount <= 1) {
      throw domainValidationError("ADMIN_LAST_ADMIN_CANNOT_REVOKE");
    }

    // 管理者権限を削除
    const updatedUser = user.updateAdminStatus(false);
    await this.userRepository.save(updatedUser);

    return updatedUser.toDto();
  }
}
