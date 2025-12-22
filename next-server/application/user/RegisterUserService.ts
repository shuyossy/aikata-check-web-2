import { IUserRepository } from "@/application/shared/port/repository";
import { IPasswordService } from "@/application/shared/port/service";
import { User, EmployeeId, Password, UserDto } from "@/domain/user";
import { AppError } from "@/lib/server/error";

/**
 * ユーザ登録コマンド
 */
export interface RegisterUserCommand {
  /** 社員ID */
  employeeId: string;
  /** 表示名 */
  displayName: string;
  /** パスワード（平文） */
  password: string;
}

/**
 * ユーザ登録サービス
 * 独自認証用のユーザ登録を行う
 */
export class RegisterUserService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordService: IPasswordService,
  ) {}

  /**
   * ユーザ登録を実行
   * @param command 登録コマンド
   * @returns ユーザDTO
   * @throws AppError - 既にユーザが存在する場合（USER_ALREADY_EXISTS）
   * @throws ドメインバリデーションエラー - 社員ID、表示名、パスワードが不正な場合
   */
  async execute(command: RegisterUserCommand): Promise<UserDto> {
    const { employeeId, displayName, password } = command;

    // 社員IDの値オブジェクト生成（バリデーション含む）
    const employeeIdVo = EmployeeId.create(employeeId);

    // パスワードの値オブジェクト生成（バリデーション含む）
    Password.create(password);

    // 既存ユーザの検索
    const existingUser =
      await this.userRepository.findByEmployeeId(employeeIdVo);

    if (existingUser) {
      // 既にユーザが存在する場合はエラー
      throw new AppError("BAD_REQUEST", {
        expose: true,
        messageCode: "USER_ALREADY_EXISTS",
      });
    }

    // パスワードを暗号化
    const encryptedPassword = this.passwordService.encrypt(password);

    // ローカルユーザを作成
    const newUser = User.createLocalUser({
      employeeId,
      displayName,
      passwordHash: encryptedPassword,
    });

    // 保存
    await this.userRepository.save(newUser);

    return newUser.toDto();
  }
}
