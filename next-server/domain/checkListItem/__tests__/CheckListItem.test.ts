import { describe, it, expect } from "vitest";
import { CheckListItem } from "../CheckListItem";

describe("CheckListItem", () => {
  const validReviewSpaceId = "123e4567-e89b-12d3-a456-426614174000";

  describe("正常系", () => {
    describe("create", () => {
      it("必須パラメータで新規チェック項目を作成できる", () => {
        const checkListItem = CheckListItem.create({
          reviewSpaceId: validReviewSpaceId,
          content: "要件定義書との整合性が確保されているか",
        });

        expect(checkListItem.id.value).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        );
        expect(checkListItem.reviewSpaceId.value).toBe(validReviewSpaceId);
        expect(checkListItem.content.value).toBe(
          "要件定義書との整合性が確保されているか",
        );
        expect(checkListItem.createdAt).toBeInstanceOf(Date);
        expect(checkListItem.updatedAt).toBeInstanceOf(Date);
      });

      it("createdAtとupdatedAtが同じ時刻で設定される", () => {
        const checkListItem = CheckListItem.create({
          reviewSpaceId: validReviewSpaceId,
          content: "テスト項目",
        });

        expect(checkListItem.createdAt.getTime()).toBe(
          checkListItem.updatedAt.getTime(),
        );
      });
    });

    describe("reconstruct", () => {
      it("DBからチェック項目を復元できる", () => {
        const id = "223e4567-e89b-12d3-a456-426614174001";
        const createdAt = new Date("2024-01-01T00:00:00Z");
        const updatedAt = new Date("2024-06-01T00:00:00Z");

        const checkListItem = CheckListItem.reconstruct({
          id,
          reviewSpaceId: validReviewSpaceId,
          content: "復元項目",
          createdAt,
          updatedAt,
        });

        expect(checkListItem.id.value).toBe(id);
        expect(checkListItem.reviewSpaceId.value).toBe(validReviewSpaceId);
        expect(checkListItem.content.value).toBe("復元項目");
        expect(checkListItem.createdAt).toBe(createdAt);
        expect(checkListItem.updatedAt).toBe(updatedAt);
      });
    });

    describe("updateContent", () => {
      it("チェック項目内容を更新できる", () => {
        const checkListItem = CheckListItem.create({
          reviewSpaceId: validReviewSpaceId,
          content: "旧内容",
        });

        const updated = checkListItem.updateContent("新内容");

        expect(updated.content.value).toBe("新内容");
        expect(updated.id.equals(checkListItem.id)).toBe(true);
        expect(updated.reviewSpaceId.equals(checkListItem.reviewSpaceId)).toBe(
          true,
        );
      });

      it("更新時にupdatedAtが更新される", () => {
        const checkListItem = CheckListItem.create({
          reviewSpaceId: validReviewSpaceId,
          content: "テスト",
        });

        const originalUpdatedAt = checkListItem.updatedAt;
        const updated = checkListItem.updateContent("新内容");

        expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
          originalUpdatedAt.getTime(),
        );
      });

      it("元のインスタンスは変更されない（不変性）", () => {
        const checkListItem = CheckListItem.create({
          reviewSpaceId: validReviewSpaceId,
          content: "旧内容",
        });

        checkListItem.updateContent("新内容");

        expect(checkListItem.content.value).toBe("旧内容");
      });
    });

    describe("toDto", () => {
      it("DTOに変換できる", () => {
        const checkListItem = CheckListItem.create({
          reviewSpaceId: validReviewSpaceId,
          content: "DTOテスト",
        });

        const dto = checkListItem.toDto();

        expect(dto.id).toBe(checkListItem.id.value);
        expect(dto.reviewSpaceId).toBe(validReviewSpaceId);
        expect(dto.content).toBe("DTOテスト");
        expect(dto.createdAt).toBeInstanceOf(Date);
        expect(dto.updatedAt).toBeInstanceOf(Date);
      });
    });

    describe("toListItemDto", () => {
      it("一覧用DTOに変換できる", () => {
        const checkListItem = CheckListItem.create({
          reviewSpaceId: validReviewSpaceId,
          content: "一覧テスト",
        });

        const dto = checkListItem.toListItemDto();

        expect(dto.id).toBe(checkListItem.id.value);
        expect(dto.content).toBe("一覧テスト");
      });
    });
  });

  describe("異常系", () => {
    describe("create", () => {
      it("無効なレビュースペースIDの場合はエラーをスローする", () => {
        expect(() =>
          CheckListItem.create({
            reviewSpaceId: "invalid-uuid",
            content: "テスト",
          }),
        ).toThrow();
      });

      it("空のチェック項目内容の場合はエラーをスローする", () => {
        expect(() =>
          CheckListItem.create({
            reviewSpaceId: validReviewSpaceId,
            content: "",
          }),
        ).toThrow();
      });
    });

    describe("updateContent", () => {
      it("空の内容に更新しようとするとエラーをスローする", () => {
        const checkListItem = CheckListItem.create({
          reviewSpaceId: validReviewSpaceId,
          content: "有効内容",
        });

        expect(() => checkListItem.updateContent("")).toThrow();
      });
    });
  });
});
