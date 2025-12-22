import { describe, it, expect } from "vitest";
import { ReviewSpace } from "../ReviewSpace";
import { DEFAULT_EVALUATION_CRITERIA } from "../EvaluationCriteria";
import {
  ReviewSettingsProps,
  DEFAULT_CONCURRENT_REVIEW_ITEMS,
  DEFAULT_COMMENT_FORMAT,
} from "../ReviewSettings";

describe("ReviewSpace", () => {
  const validProjectId = "123e4567-e89b-12d3-a456-426614174000";

  const validReviewSettings: ReviewSettingsProps = {
    additionalInstructions: "セキュリティに注意してレビューしてください",
    concurrentReviewItems: 5,
    commentFormat: "【評価理由】\n【改善提案】",
    evaluationCriteria: DEFAULT_EVALUATION_CRITERIA,
  };

  describe("正常系", () => {
    describe("create", () => {
      it("必須パラメータのみで新規レビュースペースを作成できる", () => {
        const reviewSpace = ReviewSpace.create({
          projectId: validProjectId,
          name: "設計書レビュー",
        });

        expect(reviewSpace.id.value).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        );
        expect(reviewSpace.projectId.value).toBe(validProjectId);
        expect(reviewSpace.name.value).toBe("設計書レビュー");
        expect(reviewSpace.description.value).toBeNull();
        expect(reviewSpace.createdAt).toBeInstanceOf(Date);
        expect(reviewSpace.updatedAt).toBeInstanceOf(Date);
      });

      it("説明付きで新規レビュースペースを作成できる", () => {
        const reviewSpace = ReviewSpace.create({
          projectId: validProjectId,
          name: "コードレビュー",
          description: "実装コードのレビューを実施します",
        });

        expect(reviewSpace.name.value).toBe("コードレビュー");
        expect(reviewSpace.description.value).toBe(
          "実装コードのレビューを実施します",
        );
      });

      it("createdAtとupdatedAtが同じ時刻で設定される", () => {
        const reviewSpace = ReviewSpace.create({
          projectId: validProjectId,
          name: "テストスペース",
        });

        expect(reviewSpace.createdAt.getTime()).toBe(
          reviewSpace.updatedAt.getTime(),
        );
      });

      it("デフォルトレビュー設定付きで新規レビュースペースを作成できる", () => {
        const reviewSpace = ReviewSpace.create({
          projectId: validProjectId,
          name: "設定付きスペース",
          defaultReviewSettings: validReviewSettings,
        });

        expect(reviewSpace.defaultReviewSettings).not.toBeNull();
        expect(reviewSpace.defaultReviewSettings?.additionalInstructions).toBe(
          validReviewSettings.additionalInstructions,
        );
        expect(reviewSpace.defaultReviewSettings?.concurrentReviewItems).toBe(
          5,
        );
      });

      it("デフォルトレビュー設定なしの場合はデフォルト値が設定される", () => {
        const reviewSpace = ReviewSpace.create({
          projectId: validProjectId,
          name: "設定なしスペース",
        });

        // デフォルト値が設定される
        expect(reviewSpace.defaultReviewSettings).not.toBeNull();
        expect(reviewSpace.defaultReviewSettings.concurrentReviewItems).toBe(
          DEFAULT_CONCURRENT_REVIEW_ITEMS,
        );
        expect(reviewSpace.defaultReviewSettings.commentFormat).toBe(
          DEFAULT_COMMENT_FORMAT,
        );
      });
    });

    describe("reconstruct", () => {
      it("DBからレビュースペースを復元できる", () => {
        const id = "223e4567-e89b-12d3-a456-426614174001";
        const createdAt = new Date("2024-01-01T00:00:00Z");
        const updatedAt = new Date("2024-06-01T00:00:00Z");

        const reviewSpace = ReviewSpace.reconstruct({
          id,
          projectId: validProjectId,
          name: "復元スペース",
          description: "復元説明",
          createdAt,
          updatedAt,
        });

        expect(reviewSpace.id.value).toBe(id);
        expect(reviewSpace.projectId.value).toBe(validProjectId);
        expect(reviewSpace.name.value).toBe("復元スペース");
        expect(reviewSpace.description.value).toBe("復元説明");
        expect(reviewSpace.createdAt).toBe(createdAt);
        expect(reviewSpace.updatedAt).toBe(updatedAt);
      });

      it("説明がnullでも復元できる", () => {
        const reviewSpace = ReviewSpace.reconstruct({
          id: "223e4567-e89b-12d3-a456-426614174001",
          projectId: validProjectId,
          name: "説明なしスペース",
          description: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        expect(reviewSpace.description.value).toBeNull();
      });

      it("デフォルトレビュー設定付きでDBから復元できる", () => {
        const reviewSpace = ReviewSpace.reconstruct({
          id: "223e4567-e89b-12d3-a456-426614174001",
          projectId: validProjectId,
          name: "設定付きスペース",
          description: null,
          defaultReviewSettings: validReviewSettings,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        expect(reviewSpace.defaultReviewSettings).not.toBeNull();
        expect(reviewSpace.defaultReviewSettings?.concurrentReviewItems).toBe(
          5,
        );
      });
    });

    describe("updateName", () => {
      it("スペース名を更新できる", () => {
        const reviewSpace = ReviewSpace.create({
          projectId: validProjectId,
          name: "旧名前",
        });

        const updated = reviewSpace.updateName("新名前");

        expect(updated.name.value).toBe("新名前");
        expect(updated.id.equals(reviewSpace.id)).toBe(true);
        expect(updated.projectId.equals(reviewSpace.projectId)).toBe(true);
      });

      it("更新時にupdatedAtが更新される", () => {
        const reviewSpace = ReviewSpace.create({
          projectId: validProjectId,
          name: "テスト",
        });

        // 少し待機して時間差を作る
        const originalUpdatedAt = reviewSpace.updatedAt;
        const updated = reviewSpace.updateName("新名前");

        expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
          originalUpdatedAt.getTime(),
        );
      });

      it("元のインスタンスは変更されない（不変性）", () => {
        const reviewSpace = ReviewSpace.create({
          projectId: validProjectId,
          name: "旧名前",
        });

        reviewSpace.updateName("新名前");

        expect(reviewSpace.name.value).toBe("旧名前");
      });
    });

    describe("updateDescription", () => {
      it("説明を更新できる", () => {
        const reviewSpace = ReviewSpace.create({
          projectId: validProjectId,
          name: "テスト",
          description: "旧説明",
        });

        const updated = reviewSpace.updateDescription("新説明");

        expect(updated.description.value).toBe("新説明");
      });

      it("説明をnullに更新できる", () => {
        const reviewSpace = ReviewSpace.create({
          projectId: validProjectId,
          name: "テスト",
          description: "説明あり",
        });

        const updated = reviewSpace.updateDescription(null);

        expect(updated.description.value).toBeNull();
      });
    });

    describe("updateDefaultReviewSettings", () => {
      it("デフォルトレビュー設定を更新できる", () => {
        const reviewSpace = ReviewSpace.create({
          projectId: validProjectId,
          name: "テスト",
        });

        const updated =
          reviewSpace.updateDefaultReviewSettings(validReviewSettings);

        expect(updated.defaultReviewSettings).not.toBeNull();
        expect(updated.defaultReviewSettings?.additionalInstructions).toBe(
          validReviewSettings.additionalInstructions,
        );
      });

      it("更新時にupdatedAtが更新される", () => {
        const reviewSpace = ReviewSpace.create({
          projectId: validProjectId,
          name: "テスト",
        });

        const originalUpdatedAt = reviewSpace.updatedAt;
        const updated =
          reviewSpace.updateDefaultReviewSettings(validReviewSettings);

        expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
          originalUpdatedAt.getTime(),
        );
      });

      it("元のインスタンスは変更されない（不変性）", () => {
        const reviewSpace = ReviewSpace.create({
          projectId: validProjectId,
          name: "テスト",
        });

        const originalSettings = reviewSpace.defaultReviewSettings;
        reviewSpace.updateDefaultReviewSettings(validReviewSettings);

        // 元のインスタンスのdefaultReviewSettingsは変更されない
        expect(reviewSpace.defaultReviewSettings).toBe(originalSettings);
      });
    });

    describe("toDto", () => {
      it("DTOに変換できる", () => {
        const reviewSpace = ReviewSpace.create({
          projectId: validProjectId,
          name: "DTOテスト",
          description: "DTO説明",
        });

        const dto = reviewSpace.toDto();

        expect(dto.id).toBe(reviewSpace.id.value);
        expect(dto.projectId).toBe(validProjectId);
        expect(dto.name).toBe("DTOテスト");
        expect(dto.description).toBe("DTO説明");
        expect(dto.createdAt).toBeInstanceOf(Date);
        expect(dto.updatedAt).toBeInstanceOf(Date);
        // defaultReviewSettingsはデフォルト値が設定されている
        expect(dto.defaultReviewSettings).not.toBeNull();
        expect(dto.defaultReviewSettings.concurrentReviewItems).toBe(
          DEFAULT_CONCURRENT_REVIEW_ITEMS,
        );
      });

      it("デフォルトレビュー設定付きでDTOに変換できる", () => {
        const reviewSpace = ReviewSpace.create({
          projectId: validProjectId,
          name: "設定付きDTOテスト",
          description: null,
          defaultReviewSettings: validReviewSettings,
        });

        const dto = reviewSpace.toDto();

        expect(dto.defaultReviewSettings).not.toBeNull();
        expect(dto.defaultReviewSettings?.additionalInstructions).toBe(
          validReviewSettings.additionalInstructions,
        );
      });
    });

    describe("toListItemDto", () => {
      it("一覧用DTOに変換できる", () => {
        const reviewSpace = ReviewSpace.create({
          projectId: validProjectId,
          name: "一覧テスト",
          description: "一覧説明",
        });

        const dto = reviewSpace.toListItemDto();

        expect(dto.id).toBe(reviewSpace.id.value);
        expect(dto.name).toBe("一覧テスト");
        expect(dto.description).toBe("一覧説明");
        expect(dto.updatedAt).toBe(reviewSpace.updatedAt.toISOString());
      });
    });

    describe("checklistGenerationError", () => {
      it("新規作成時はchecklistGenerationErrorがnull", () => {
        const reviewSpace = ReviewSpace.create({
          projectId: validProjectId,
          name: "テスト",
        });

        expect(reviewSpace.checklistGenerationError).toBeNull();
      });

      it("setChecklistGenerationErrorでエラーメッセージを設定できる", () => {
        const reviewSpace = ReviewSpace.create({
          projectId: validProjectId,
          name: "テスト",
        });

        const updated =
          reviewSpace.setChecklistGenerationError("エラー発生しました");

        expect(updated.checklistGenerationError).toBe("エラー発生しました");
      });

      it("clearChecklistGenerationErrorでエラーメッセージをクリアできる", () => {
        const reviewSpace = ReviewSpace.reconstruct({
          id: "223e4567-e89b-12d3-a456-426614174001",
          projectId: validProjectId,
          name: "テスト",
          description: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          checklistGenerationError: "既存のエラー",
        });

        const cleared = reviewSpace.clearChecklistGenerationError();

        expect(cleared.checklistGenerationError).toBeNull();
      });

      it("元のインスタンスは変更されない（不変性）", () => {
        const reviewSpace = ReviewSpace.create({
          projectId: validProjectId,
          name: "テスト",
        });

        reviewSpace.setChecklistGenerationError("エラー");

        expect(reviewSpace.checklistGenerationError).toBeNull();
      });

      it("reconstruct時にchecklistGenerationErrorが復元される", () => {
        const reviewSpace = ReviewSpace.reconstruct({
          id: "223e4567-e89b-12d3-a456-426614174001",
          projectId: validProjectId,
          name: "テスト",
          description: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          checklistGenerationError: "保存されたエラー",
        });

        expect(reviewSpace.checklistGenerationError).toBe("保存されたエラー");
      });

      it("toDtoにchecklistGenerationErrorが含まれる", () => {
        const reviewSpace = ReviewSpace.reconstruct({
          id: "223e4567-e89b-12d3-a456-426614174001",
          projectId: validProjectId,
          name: "テスト",
          description: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          checklistGenerationError: "DTOエラー",
        });

        const dto = reviewSpace.toDto();

        expect(dto.checklistGenerationError).toBe("DTOエラー");
      });

      it("updateName後もchecklistGenerationErrorが保持される", () => {
        const reviewSpace = ReviewSpace.reconstruct({
          id: "223e4567-e89b-12d3-a456-426614174001",
          projectId: validProjectId,
          name: "テスト",
          description: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          checklistGenerationError: "保持されるエラー",
        });

        const updated = reviewSpace.updateName("新しい名前");

        expect(updated.checklistGenerationError).toBe("保持されるエラー");
      });

      it("updateDescription後もchecklistGenerationErrorが保持される", () => {
        const reviewSpace = ReviewSpace.reconstruct({
          id: "223e4567-e89b-12d3-a456-426614174001",
          projectId: validProjectId,
          name: "テスト",
          description: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          checklistGenerationError: "保持されるエラー",
        });

        const updated = reviewSpace.updateDescription("新しい説明");

        expect(updated.checklistGenerationError).toBe("保持されるエラー");
      });

      it("updateDefaultReviewSettings後もchecklistGenerationErrorが保持される", () => {
        const reviewSpace = ReviewSpace.reconstruct({
          id: "223e4567-e89b-12d3-a456-426614174001",
          projectId: validProjectId,
          name: "テスト",
          description: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          checklistGenerationError: "保持されるエラー",
        });

        const updated =
          reviewSpace.updateDefaultReviewSettings(validReviewSettings);

        expect(updated.checklistGenerationError).toBe("保持されるエラー");
      });
    });
  });

  describe("異常系", () => {
    describe("create", () => {
      it("無効なプロジェクトIDの場合はエラーをスローする", () => {
        expect(() =>
          ReviewSpace.create({
            projectId: "invalid-uuid",
            name: "テスト",
          }),
        ).toThrow();
      });

      it("空のスペース名の場合はエラーをスローする", () => {
        expect(() =>
          ReviewSpace.create({
            projectId: validProjectId,
            name: "",
          }),
        ).toThrow();
      });

      it("長すぎるスペース名の場合はエラーをスローする", () => {
        expect(() =>
          ReviewSpace.create({
            projectId: validProjectId,
            name: "あ".repeat(101),
          }),
        ).toThrow();
      });

      it("長すぎる説明の場合はエラーをスローする", () => {
        expect(() =>
          ReviewSpace.create({
            projectId: validProjectId,
            name: "テスト",
            description: "あ".repeat(1001),
          }),
        ).toThrow();
      });
    });

    describe("updateName", () => {
      it("空のスペース名に更新しようとするとエラーをスローする", () => {
        const reviewSpace = ReviewSpace.create({
          projectId: validProjectId,
          name: "有効名",
        });

        expect(() => reviewSpace.updateName("")).toThrow();
      });
    });

    describe("updateDescription", () => {
      it("長すぎる説明に更新しようとするとエラーをスローする", () => {
        const reviewSpace = ReviewSpace.create({
          projectId: validProjectId,
          name: "テスト",
        });

        expect(() =>
          reviewSpace.updateDescription("あ".repeat(1001)),
        ).toThrow();
      });
    });
  });
});
