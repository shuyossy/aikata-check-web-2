import { describe, it, expect } from "vitest";
import { Password } from "../Password";
import { AppError } from "@/lib/server/error";

describe("Password", () => {
  describe("create", () => {
    it("有効なパスワードでPasswordを作成できること", () => {
      const password = Password.create("password123");
      expect(password.value).toBe("password123");
    });

    it("1文字のパスワードでも作成できること", () => {
      const password = Password.create("a");
      expect(password.value).toBe("a");
    });

    it("日本語を含むパスワードでも作成できること", () => {
      const password = Password.create("パスワード123");
      expect(password.value).toBe("パスワード123");
    });

    it("特殊文字を含むパスワードでも作成できること", () => {
      const password = Password.create("p@ssw0rd!#$%");
      expect(password.value).toBe("p@ssw0rd!#$%");
    });

    it("空文字の場合はエラーになること", () => {
      expect(() => Password.create("")).toThrow(AppError);
      try {
        Password.create("");
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).messageCode).toBe("PASSWORD_EMPTY");
      }
    });

    it("空白のみの場合はエラーになること", () => {
      expect(() => Password.create("   ")).toThrow(AppError);
      try {
        Password.create("   ");
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).messageCode).toBe("PASSWORD_EMPTY");
      }
    });

    it("nullの場合はエラーになること", () => {
      expect(() => Password.create(null as unknown as string)).toThrow(
        AppError,
      );
      try {
        Password.create(null as unknown as string);
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).messageCode).toBe("PASSWORD_EMPTY");
      }
    });

    it("undefinedの場合はエラーになること", () => {
      expect(() => Password.create(undefined as unknown as string)).toThrow(
        AppError,
      );
      try {
        Password.create(undefined as unknown as string);
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).messageCode).toBe("PASSWORD_EMPTY");
      }
    });
  });

  describe("equals", () => {
    it("同じ値のPasswordは等しいこと", () => {
      const password1 = Password.create("password123");
      const password2 = Password.create("password123");
      expect(password1.equals(password2)).toBe(true);
    });

    it("異なる値のPasswordは等しくないこと", () => {
      const password1 = Password.create("password123");
      const password2 = Password.create("password456");
      expect(password1.equals(password2)).toBe(false);
    });
  });
});
