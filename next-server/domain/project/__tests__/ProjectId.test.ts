import { describe, it, expect } from "vitest";
import { ProjectId } from "../ProjectId";

describe("ProjectId", () => {
  describe("create", () => {
    it("新規UUIDを生成できる", () => {
      const projectId = ProjectId.create();

      expect(projectId.value).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it("生成されるUUIDは毎回異なる", () => {
      const id1 = ProjectId.create();
      const id2 = ProjectId.create();

      expect(id1.value).not.toBe(id2.value);
    });
  });

  describe("reconstruct", () => {
    it("有効なUUID文字列から復元できる", () => {
      const validUuid = "123e4567-e89b-12d3-a456-426614174000";
      const projectId = ProjectId.reconstruct(validUuid);

      expect(projectId.value).toBe(validUuid);
    });

    it("無効なUUID文字列の場合はエラーをスローする", () => {
      expect(() => ProjectId.reconstruct("invalid-uuid")).toThrow();
    });

    it("空文字列の場合はエラーをスローする", () => {
      expect(() => ProjectId.reconstruct("")).toThrow();
    });
  });

  describe("equals", () => {
    it("同じ値を持つProjectIdは等しい", () => {
      const uuid = "123e4567-e89b-12d3-a456-426614174000";
      const id1 = ProjectId.reconstruct(uuid);
      const id2 = ProjectId.reconstruct(uuid);

      expect(id1.equals(id2)).toBe(true);
    });

    it("異なる値を持つProjectIdは等しくない", () => {
      const id1 = ProjectId.create();
      const id2 = ProjectId.create();

      expect(id1.equals(id2)).toBe(false);
    });
  });

  describe("toString", () => {
    it("UUID文字列を返す", () => {
      const uuid = "123e4567-e89b-12d3-a456-426614174000";
      const projectId = ProjectId.reconstruct(uuid);

      expect(projectId.toString()).toBe(uuid);
    });
  });
});
