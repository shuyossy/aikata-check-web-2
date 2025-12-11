import { describe, it, expect } from "vitest";
import { CheckListItemId } from "../CheckListItemId";

describe("CheckListItemId", () => {
  describe("正常系", () => {
    describe("create", () => {
      it("新規UUIDを生成できる", () => {
        const checkListItemId = CheckListItemId.create();

        expect(checkListItemId.value).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        );
      });

      it("生成されるUUIDは毎回異なる", () => {
        const id1 = CheckListItemId.create();
        const id2 = CheckListItemId.create();

        expect(id1.value).not.toBe(id2.value);
      });
    });

    describe("reconstruct", () => {
      it("有効なUUID文字列から復元できる", () => {
        const validUuid = "123e4567-e89b-12d3-a456-426614174000";
        const checkListItemId = CheckListItemId.reconstruct(validUuid);

        expect(checkListItemId.value).toBe(validUuid);
      });
    });

    describe("equals", () => {
      it("同じ値を持つCheckListItemIdは等しい", () => {
        const uuid = "123e4567-e89b-12d3-a456-426614174000";
        const id1 = CheckListItemId.reconstruct(uuid);
        const id2 = CheckListItemId.reconstruct(uuid);

        expect(id1.equals(id2)).toBe(true);
      });

      it("異なる値を持つCheckListItemIdは等しくない", () => {
        const id1 = CheckListItemId.create();
        const id2 = CheckListItemId.create();

        expect(id1.equals(id2)).toBe(false);
      });
    });

    describe("toString", () => {
      it("UUID文字列を返す", () => {
        const uuid = "123e4567-e89b-12d3-a456-426614174000";
        const checkListItemId = CheckListItemId.reconstruct(uuid);

        expect(checkListItemId.toString()).toBe(uuid);
      });
    });
  });

  describe("異常系", () => {
    describe("reconstruct", () => {
      it("無効なUUID文字列の場合はエラーをスローする", () => {
        expect(() => CheckListItemId.reconstruct("invalid-uuid")).toThrow();
      });

      it("空文字列の場合はエラーをスローする", () => {
        expect(() => CheckListItemId.reconstruct("")).toThrow();
      });

      it("nullish値の場合はエラーをスローする", () => {
        expect(() =>
          CheckListItemId.reconstruct(null as unknown as string),
        ).toThrow();
        expect(() =>
          CheckListItemId.reconstruct(undefined as unknown as string),
        ).toThrow();
      });
    });
  });
});
