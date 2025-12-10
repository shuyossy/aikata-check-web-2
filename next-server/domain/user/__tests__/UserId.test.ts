import { describe, it, expect } from "vitest";
import { UserId } from "../UserId";

describe("UserId", () => {
  describe("create", () => {
    it("新規UUIDを生成できる", () => {
      const userId = UserId.create();

      expect(userId).toBeDefined();
      expect(userId.value).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it("生成されるUUIDは毎回異なる", () => {
      const userId1 = UserId.create();
      const userId2 = UserId.create();

      expect(userId1.value).not.toBe(userId2.value);
    });
  });

  describe("reconstruct", () => {
    it("有効なUUID文字列から復元できる", () => {
      const validUuid = "550e8400-e29b-41d4-a716-446655440000";
      const userId = UserId.reconstruct(validUuid);

      expect(userId.value).toBe(validUuid);
    });

    it("小文字のUUIDも受け入れる", () => {
      const lowerCaseUuid = "550e8400-e29b-41d4-a716-446655440000";
      const userId = UserId.reconstruct(lowerCaseUuid);

      expect(userId.value).toBe(lowerCaseUuid);
    });

    it("大文字のUUIDも受け入れる", () => {
      const upperCaseUuid = "550E8400-E29B-41D4-A716-446655440000";
      const userId = UserId.reconstruct(upperCaseUuid);

      expect(userId.value).toBe(upperCaseUuid);
    });
  });

  describe("バリデーション（異常系）", () => {
    it("空文字列の場合はエラーになる", () => {
      expect(() => UserId.reconstruct("")).toThrow();
    });

    it("不正な形式の文字列の場合はエラーになる", () => {
      expect(() => UserId.reconstruct("not-a-uuid")).toThrow();
    });

    it("ハイフンなしのUUIDはエラーになる", () => {
      expect(() =>
        UserId.reconstruct("550e8400e29b41d4a716446655440000"),
      ).toThrow();
    });

    it("長さが不正なUUIDはエラーになる", () => {
      expect(() => UserId.reconstruct("550e8400-e29b-41d4-a716")).toThrow();
    });

    it("nullの場合はエラーになる", () => {
      expect(() => UserId.reconstruct(null as unknown as string)).toThrow();
    });

    it("undefinedの場合はエラーになる", () => {
      expect(() =>
        UserId.reconstruct(undefined as unknown as string),
      ).toThrow();
    });
  });

  describe("equals", () => {
    it("同じ値を持つUserIdは等しい", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      const userId1 = UserId.reconstruct(uuid);
      const userId2 = UserId.reconstruct(uuid);

      expect(userId1.equals(userId2)).toBe(true);
    });

    it("異なる値を持つUserIdは等しくない", () => {
      const userId1 = UserId.create();
      const userId2 = UserId.create();

      expect(userId1.equals(userId2)).toBe(false);
    });
  });
});
