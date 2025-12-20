import { describe, it, expect, beforeEach, vi } from "vitest";
import { User } from "../User";
import { UserId } from "../UserId";
import { EmployeeId } from "../EmployeeId";

describe("User", () => {
  // テスト用の固定日時
  const fixedDate = new Date("2024-01-01T00:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);
  });

  describe("create", () => {
    it("有効なデータでUserエンティティを作成できる", () => {
      const user = User.create({
        employeeId: "EMP001",
        displayName: "山田太郎",
      });

      expect(user.id).toBeDefined();
      expect(user.employeeId.value).toBe("EMP001");
      expect(user.displayName).toBe("山田太郎");
      expect(user.isAdmin).toBe(false);
      expect(user.createdAt).toEqual(fixedDate);
      expect(user.updatedAt).toEqual(fixedDate);
    });

    it("isAdminをtrueで作成できる", () => {
      const user = User.create({
        employeeId: "EMP001",
        displayName: "管理者",
        isAdmin: true,
      });

      expect(user.isAdmin).toBe(true);
    });

    it("isAdminを指定しない場合はfalseになる", () => {
      const user = User.create({
        employeeId: "EMP001",
        displayName: "一般ユーザ",
      });

      expect(user.isAdmin).toBe(false);
    });

    it("作成時にUserIdが自動生成される", () => {
      const user1 = User.create({
        employeeId: "EMP001",
        displayName: "山田太郎",
      });
      const user2 = User.create({
        employeeId: "EMP002",
        displayName: "鈴木花子",
      });

      expect(user1.id.value).not.toBe(user2.id.value);
    });
  });

  describe("reconstruct", () => {
    it("DBから取得したデータでUserを復元できる", () => {
      const id = "550e8400-e29b-41d4-a716-446655440000";
      const createdAt = new Date("2023-01-01T00:00:00.000Z");
      const updatedAt = new Date("2023-06-01T00:00:00.000Z");

      const user = User.reconstruct({
        id,
        employeeId: "EMP001",
        displayName: "山田太郎",
        isAdmin: false,
        createdAt,
        updatedAt,
      });

      expect(user.id.value).toBe(id);
      expect(user.employeeId.value).toBe("EMP001");
      expect(user.displayName).toBe("山田太郎");
      expect(user.isAdmin).toBe(false);
      expect(user.createdAt).toEqual(createdAt);
      expect(user.updatedAt).toEqual(updatedAt);
    });

    it("管理者フラグをtrueで復元できる", () => {
      const user = User.reconstruct({
        id: "550e8400-e29b-41d4-a716-446655440000",
        employeeId: "EMP001",
        displayName: "管理者",
        isAdmin: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(user.isAdmin).toBe(true);
    });
  });

  describe("updateDisplayName", () => {
    it("表示名を更新できる", () => {
      const user = User.create({
        employeeId: "EMP001",
        displayName: "山田太郎",
      });

      // 時間を進める
      const laterDate = new Date("2024-06-01T00:00:00.000Z");
      vi.setSystemTime(laterDate);

      const updatedUser = user.updateDisplayName("山田次郎");

      expect(updatedUser.displayName).toBe("山田次郎");
      expect(updatedUser.updatedAt).toEqual(laterDate);
      // その他のプロパティは変更されない
      expect(updatedUser.id.value).toBe(user.id.value);
      expect(updatedUser.employeeId.value).toBe(user.employeeId.value);
      expect(updatedUser.createdAt).toEqual(user.createdAt);
    });

    it("同じ表示名で更新しても新しいインスタンスが返される", () => {
      const user = User.create({
        employeeId: "EMP001",
        displayName: "山田太郎",
      });

      const updatedUser = user.updateDisplayName("山田太郎");

      // 同じ名前でも新しいインスタンス
      expect(updatedUser).not.toBe(user);
      expect(updatedUser.displayName).toBe("山田太郎");
    });

    it("元のUserインスタンスは不変である", () => {
      const user = User.create({
        employeeId: "EMP001",
        displayName: "山田太郎",
      });
      const originalDisplayName = user.displayName;
      const originalUpdatedAt = user.updatedAt;

      // 時間を進める
      vi.setSystemTime(new Date("2024-06-01T00:00:00.000Z"));
      user.updateDisplayName("山田次郎");

      // 元のインスタンスは変更されていない
      expect(user.displayName).toBe(originalDisplayName);
      expect(user.updatedAt).toEqual(originalUpdatedAt);
    });
  });

  describe("バリデーション（異常系）", () => {
    it("空の社員IDではエラーになる", () => {
      expect(() =>
        User.create({
          employeeId: "",
          displayName: "山田太郎",
        }),
      ).toThrow();
    });

    it("255文字超の社員IDではエラーになる", () => {
      expect(() =>
        User.create({
          employeeId: "A".repeat(256),
          displayName: "山田太郎",
        }),
      ).toThrow();
    });

    it("空の表示名ではエラーになる", () => {
      expect(() =>
        User.create({
          employeeId: "EMP001",
          displayName: "",
        }),
      ).toThrow();
    });

    it("空白のみの表示名ではエラーになる", () => {
      expect(() =>
        User.create({
          employeeId: "EMP001",
          displayName: "   ",
        }),
      ).toThrow();
    });

    it("不正なUserIdでreconstructするとエラーになる", () => {
      expect(() =>
        User.reconstruct({
          id: "invalid-uuid",
          employeeId: "EMP001",
          displayName: "山田太郎",
          isAdmin: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ).toThrow();
    });
  });

  describe("updateAdminStatus", () => {
    it("管理者フラグをtrueに更新できる", () => {
      const user = User.create({
        employeeId: "EMP001",
        displayName: "一般ユーザ",
        isAdmin: false,
      });

      // 時間を進める
      const laterDate = new Date("2024-06-01T00:00:00.000Z");
      vi.setSystemTime(laterDate);

      const updatedUser = user.updateAdminStatus(true);

      expect(updatedUser.isAdmin).toBe(true);
      expect(updatedUser.updatedAt).toEqual(laterDate);
      // その他のプロパティは変更されない
      expect(updatedUser.id.value).toBe(user.id.value);
      expect(updatedUser.employeeId.value).toBe(user.employeeId.value);
      expect(updatedUser.displayName).toBe(user.displayName);
      expect(updatedUser.createdAt).toEqual(user.createdAt);
    });

    it("管理者フラグをfalseに更新できる", () => {
      const user = User.create({
        employeeId: "EMP001",
        displayName: "管理者",
        isAdmin: true,
      });

      const updatedUser = user.updateAdminStatus(false);

      expect(updatedUser.isAdmin).toBe(false);
    });

    it("元のUserインスタンスは不変である", () => {
      const user = User.create({
        employeeId: "EMP001",
        displayName: "一般ユーザ",
        isAdmin: false,
      });

      user.updateAdminStatus(true);

      // 元のインスタンスは変更されていない
      expect(user.isAdmin).toBe(false);
    });
  });

  describe("hasDisplayNameChanged", () => {
    it("表示名が異なる場合はtrueを返す", () => {
      const user = User.create({
        employeeId: "EMP001",
        displayName: "山田太郎",
      });

      expect(user.hasDisplayNameChanged("山田次郎")).toBe(true);
    });

    it("表示名が同じ場合はfalseを返す", () => {
      const user = User.create({
        employeeId: "EMP001",
        displayName: "山田太郎",
      });

      expect(user.hasDisplayNameChanged("山田太郎")).toBe(false);
    });
  });

  describe("toDto", () => {
    it("DTOに変換できる", () => {
      const user = User.create({
        employeeId: "EMP001",
        displayName: "山田太郎",
      });

      const dto = user.toDto();

      expect(dto).toEqual({
        id: user.id.value,
        employeeId: "EMP001",
        displayName: "山田太郎",
        isAdmin: false,
      });
    });

    it("管理者のDTOに変換できる", () => {
      const user = User.create({
        employeeId: "EMP001",
        displayName: "管理者",
        isAdmin: true,
      });

      const dto = user.toDto();

      expect(dto).toEqual({
        id: user.id.value,
        employeeId: "EMP001",
        displayName: "管理者",
        isAdmin: true,
      });
    });
  });
});
