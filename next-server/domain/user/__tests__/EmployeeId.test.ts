import { describe, it, expect } from "vitest";
import { EmployeeId } from "../EmployeeId";

describe("EmployeeId", () => {
  describe("create", () => {
    it("有効な社員ID文字列からEmployeeIdを作成できる", () => {
      const employeeId = EmployeeId.create("EMP001");

      expect(employeeId.value).toBe("EMP001");
    });

    it("1文字の社員IDも作成できる", () => {
      const employeeId = EmployeeId.create("A");

      expect(employeeId.value).toBe("A");
    });

    it("255文字の社員IDも作成できる", () => {
      const longId = "A".repeat(255);
      const employeeId = EmployeeId.create(longId);

      expect(employeeId.value).toBe(longId);
      expect(employeeId.value.length).toBe(255);
    });

    it("日本語の社員IDも作成できる", () => {
      const employeeId = EmployeeId.create("山田太郎");

      expect(employeeId.value).toBe("山田太郎");
    });

    it("特殊文字を含む社員IDも作成できる", () => {
      const employeeId = EmployeeId.create("user@domain.com");

      expect(employeeId.value).toBe("user@domain.com");
    });
  });

  describe("reconstruct", () => {
    it("既存の社員ID文字列から復元できる", () => {
      const employeeId = EmployeeId.reconstruct("EMP002");

      expect(employeeId.value).toBe("EMP002");
    });
  });

  describe("バリデーション（異常系）", () => {
    it("空文字列の場合はエラーになる", () => {
      expect(() => EmployeeId.create("")).toThrow();
    });

    it("reconstructでも空文字列はエラーになる", () => {
      expect(() => EmployeeId.reconstruct("")).toThrow();
    });

    it("256文字以上の場合はエラーになる", () => {
      const tooLongId = "A".repeat(256);
      expect(() => EmployeeId.create(tooLongId)).toThrow();
    });

    it("nullの場合はエラーになる", () => {
      expect(() => EmployeeId.create(null as unknown as string)).toThrow();
    });

    it("undefinedの場合はエラーになる", () => {
      expect(() => EmployeeId.create(undefined as unknown as string)).toThrow();
    });

    it("空白のみの場合はエラーになる", () => {
      expect(() => EmployeeId.create("   ")).toThrow();
    });
  });

  describe("equals", () => {
    it("同じ値を持つEmployeeIdは等しい", () => {
      const employeeId1 = EmployeeId.create("EMP001");
      const employeeId2 = EmployeeId.create("EMP001");

      expect(employeeId1.equals(employeeId2)).toBe(true);
    });

    it("異なる値を持つEmployeeIdは等しくない", () => {
      const employeeId1 = EmployeeId.create("EMP001");
      const employeeId2 = EmployeeId.create("EMP002");

      expect(employeeId1.equals(employeeId2)).toBe(false);
    });

    it("大文字小文字は区別される", () => {
      const employeeId1 = EmployeeId.create("emp001");
      const employeeId2 = EmployeeId.create("EMP001");

      expect(employeeId1.equals(employeeId2)).toBe(false);
    });
  });
});
