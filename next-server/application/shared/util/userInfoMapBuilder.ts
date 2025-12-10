import { User } from "@/domain/user";
import { UserInfo } from "@/domain/project";

/**
 * ユーザリストからUserInfoマップを構築する
 * @param users ユーザリスト
 * @returns ユーザIDをキーとするUserInfoマップ
 */
export function buildUserInfoMap(users: User[]): Map<string, UserInfo> {
  const map = new Map<string, UserInfo>();
  for (const user of users) {
    map.set(user.id.value, {
      displayName: user.displayName,
      employeeId: user.employeeId.value,
    });
  }
  return map;
}

/**
 * ユーザリストから表示名のみのマップを構築する
 * ListItemDtoなどemployeeIdが不要な場合に使用
 * @param users ユーザリスト
 * @returns ユーザIDをキーとする表示名マップ
 */
export function buildUserNameMap(users: User[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const user of users) {
    map.set(user.id.value, user.displayName);
  }
  return map;
}
