import { IUserRepository } from "@/application/shared/port/repository";
import { UserDto } from "@/domain/user";

/**
 * 管理者一覧取得サービス
 * 全ての管理者ユーザを取得する
 */
export class ListAdminsService {
  constructor(private readonly userRepository: IUserRepository) {}

  /**
   * 管理者一覧を取得する
   * @returns 管理者ユーザDTOの配列
   */
  async execute(): Promise<UserDto[]> {
    const admins = await this.userRepository.findAllAdmins();
    return admins.map((admin) => admin.toDto());
  }
}
