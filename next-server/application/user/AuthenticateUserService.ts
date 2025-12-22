import { IUserRepository } from "@/application/shared/port/repository";
import { IPasswordService } from "@/application/shared/port/service";
import { EmployeeId, Password, UserDto } from "@/domain/user";
import { AppError } from "@/lib/server/error";

/**
 * ユーザ認証コマンド
 */
export interface AuthenticateUserCommand {
  /** 社員ID */
  employeeId: string;
  /** パスワード（平文） */
  password: string;
}

/**
 * ユーザ認証サービス
 * 独自認証でユーザを認証する
 */
export class AuthenticateUserService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordService: IPasswordService,
  ) {}

  /**
   * ユーザ認証を実行
   * @param command 認証コマンド
   * @returns ユーザDTO
   * @throws AppError - 認証に失敗した場合（INVALID_CREDENTIALS）
   * @throws ドメインバリデーションエラー - 社員ID、パスワードが不正な場合
   */
  async execute(command: AuthenticateUserCommand): Promise<UserDto> {
    const { employeeId, password } = command;

    // 社員IDの値オブジェクト生成（バリデーション含む）
    const employeeIdVo = EmployeeId.create(employeeId);

    // パスワードの値オブジェクト生成（バリデーション含む）
    Password.create(password);

    // ユーザの検索
    const user = await this.userRepository.findByEmployeeId(employeeIdVo);

    // ユーザが存在しない場合はエラー
    if (!user) {
      throw new AppError("UNAUTHORIZED", {
        expose: true,
        messageCode: "INVALID_CREDENTIALS",
      });
    }

    // SSOユーザ（passwordHashがない）の場合はエラー
    if (!user.hasPasswordHash()) {
      throw new AppError("UNAUTHORIZED", {
        expose: true,
        messageCode: "INVALID_CREDENTIALS",
      });
    }

    // パスワードを検証
    const isValidPassword = this.passwordService.verify(
      password,
      user.passwordHash!,
    );

    if (!isValidPassword) {
      throw new AppError("UNAUTHORIZED", {
        expose: true,
        messageCode: "INVALID_CREDENTIALS",
      });
    }

    return user.toDto();
  }
}
