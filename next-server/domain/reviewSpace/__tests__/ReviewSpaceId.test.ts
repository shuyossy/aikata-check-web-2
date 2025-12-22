import { describe, it, expect } from "vitest";
import { ReviewSpaceId } from "../ReviewSpaceId";

describe("ReviewSpaceId", () => {
  describe("正常系", () => {
    describe("create", () => {
      it("新規UUIDを生成できる", () => {
        const reviewSpaceId = ReviewSpaceId.create();

        expect(reviewSpaceId.value).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        );
      });

      it("生成されるUUIDは毎回異なる", () => {
        const id1 = ReviewSpaceId.create();
        const id2 = ReviewSpaceId.create();

        expect(id1.value).not.toBe(id2.value);
      });
    });

    describe("reconstruct", () => {
      it("有効なUUID文字列から復元できる", () => {
        const validUuid = "123e4567-e89b-12d3-a456-426614174000";
        const reviewSpaceId = ReviewSpaceId.reconstruct(validUuid);

        expect(reviewSpaceId.value).toBe(validUuid);
      });
    });

    describe("equals", () => {
      it("同じ値を持つReviewSpaceIdは等しい", () => {
        const uuid = "123e4567-e89b-12d3-a456-426614174000";
        const id1 = ReviewSpaceId.reconstruct(uuid);
        const id2 = ReviewSpaceId.reconstruct(uuid);

        expect(id1.equals(id2)).toBe(true);
      });

      it("異なる値を持つReviewSpaceIdは等しくない", () => {
        const id1 = ReviewSpaceId.create();
        const id2 = ReviewSpaceId.create();

        expect(id1.equals(id2)).toBe(false);
      });
    });

    describe("toString", () => {
      it("UUID文字列を返す", () => {
        const uuid = "123e4567-e89b-12d3-a456-426614174000";
        const reviewSpaceId = ReviewSpaceId.reconstruct(uuid);

        expect(reviewSpaceId.toString()).toBe(uuid);
      });
    });
  });

  describe("異常系", () => {
    describe("reconstruct", () => {
      it("無効なUUID文字列の場合はエラーをスローする", () => {
        expect(() => ReviewSpaceId.reconstruct("invalid-uuid")).toThrow();
      });

      it("空文字列の場合はエラーをスローする", () => {
        expect(() => ReviewSpaceId.reconstruct("")).toThrow();
      });

      it("nullish値の場合はエラーをスローする", () => {
        expect(() =>
          ReviewSpaceId.reconstruct(null as unknown as string),
        ).toThrow();
        expect(() =>
          ReviewSpaceId.reconstruct(undefined as unknown as string),
        ).toThrow();
      });
    });
  });
});
