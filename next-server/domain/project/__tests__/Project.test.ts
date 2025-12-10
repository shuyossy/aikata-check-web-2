import { describe, it, expect, beforeEach, vi } from "vitest";
import { Project } from "../Project";

// 暗号化関数をモック
vi.mock("@/lib/server/encryption", () => ({
  encrypt: vi.fn((text: string) => `encrypted_${text}`),
  decrypt: vi.fn((text: string) => text.replace("encrypted_", "")),
}));

describe("Project", () => {
  const validMemberId = "123e4567-e89b-12d3-a456-426614174000";
  const validMemberId2 = "223e4567-e89b-12d3-a456-426614174001";

  describe("create", () => {
    it("有効なパラメータでプロジェクトを作成できる", () => {
      const project = Project.create({
        name: "テストプロジェクト",
        description: "テスト説明",
        apiKey: "sk-test123",
        memberIds: [validMemberId],
      });

      expect(project.name.value).toBe("テストプロジェクト");
      expect(project.description.value).toBe("テスト説明");
      expect(project.encryptedApiKey.hasValue()).toBe(true);
      expect(project.members).toHaveLength(1);
      expect(project.members[0].userId.value).toBe(validMemberId);
    });

    it("説明とAPIキーなしでプロジェクトを作成できる", () => {
      const project = Project.create({
        name: "テストプロジェクト",
        memberIds: [validMemberId],
      });

      expect(project.name.value).toBe("テストプロジェクト");
      expect(project.description.value).toBeNull();
      expect(project.encryptedApiKey.hasValue()).toBe(false);
    });

    it("複数のメンバーでプロジェクトを作成できる", () => {
      const project = Project.create({
        name: "テストプロジェクト",
        memberIds: [validMemberId, validMemberId2],
      });

      expect(project.members).toHaveLength(2);
    });

    it("メンバーが空の場合はエラーをスローする", () => {
      expect(() =>
        Project.create({
          name: "テストプロジェクト",
          memberIds: [],
        }),
      ).toThrow();
    });

    it("プロジェクト名が空の場合はエラーをスローする", () => {
      expect(() =>
        Project.create({
          name: "",
          memberIds: [validMemberId],
        }),
      ).toThrow();
    });
  });

  describe("reconstruct", () => {
    it("DBからのデータでプロジェクトを復元できる", () => {
      const now = new Date();
      const project = Project.reconstruct({
        id: "323e4567-e89b-12d3-a456-426614174002",
        name: "復元プロジェクト",
        description: "復元説明",
        encryptedApiKey: "encrypted_key",
        members: [{ userId: validMemberId, createdAt: now }],
        createdAt: now,
        updatedAt: now,
      });

      expect(project.id.value).toBe("323e4567-e89b-12d3-a456-426614174002");
      expect(project.name.value).toBe("復元プロジェクト");
      expect(project.description.value).toBe("復元説明");
      expect(project.encryptedApiKey.hasValue()).toBe(true);
      expect(project.members).toHaveLength(1);
    });
  });

  describe("updateName", () => {
    it("プロジェクト名を更新できる", () => {
      const project = Project.create({
        name: "元の名前",
        memberIds: [validMemberId],
      });

      const updated = project.updateName("新しい名前");

      expect(updated.name.value).toBe("新しい名前");
      expect(updated.id.equals(project.id)).toBe(true);
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
        project.updatedAt.getTime(),
      );
    });
  });

  describe("updateDescription", () => {
    it("プロジェクト説明を更新できる", () => {
      const project = Project.create({
        name: "テスト",
        description: "元の説明",
        memberIds: [validMemberId],
      });

      const updated = project.updateDescription("新しい説明");

      expect(updated.description.value).toBe("新しい説明");
    });

    it("プロジェクト説明をnullに更新できる", () => {
      const project = Project.create({
        name: "テスト",
        description: "元の説明",
        memberIds: [validMemberId],
      });

      const updated = project.updateDescription(null);

      expect(updated.description.value).toBeNull();
    });
  });

  describe("updateApiKey", () => {
    it("APIキーを更新できる", () => {
      const project = Project.create({
        name: "テスト",
        memberIds: [validMemberId],
      });

      const updated = project.updateApiKey("new-api-key");

      expect(updated.encryptedApiKey.hasValue()).toBe(true);
    });

    it("APIキーをnullに更新できる", () => {
      const project = Project.create({
        name: "テスト",
        apiKey: "old-key",
        memberIds: [validMemberId],
      });

      const updated = project.updateApiKey(null);

      expect(updated.encryptedApiKey.hasValue()).toBe(false);
    });
  });

  describe("addMember", () => {
    it("メンバーを追加できる", () => {
      const project = Project.create({
        name: "テスト",
        memberIds: [validMemberId],
      });

      const updated = project.addMember(validMemberId2);

      expect(updated.members).toHaveLength(2);
      expect(updated.hasMember(validMemberId2)).toBe(true);
    });

    it("既に存在するメンバーを追加するとエラー", () => {
      const project = Project.create({
        name: "テスト",
        memberIds: [validMemberId],
      });

      expect(() => project.addMember(validMemberId)).toThrow();
    });
  });

  describe("removeMember", () => {
    it("メンバーを削除できる", () => {
      const project = Project.create({
        name: "テスト",
        memberIds: [validMemberId, validMemberId2],
      });

      const updated = project.removeMember(validMemberId2);

      expect(updated.members).toHaveLength(1);
      expect(updated.hasMember(validMemberId2)).toBe(false);
    });

    it("存在しないメンバーを削除するとエラー", () => {
      const project = Project.create({
        name: "テスト",
        memberIds: [validMemberId],
      });

      expect(() => project.removeMember(validMemberId2)).toThrow();
    });

    it("最後の1人を削除するとエラー", () => {
      const project = Project.create({
        name: "テスト",
        memberIds: [validMemberId],
      });

      expect(() => project.removeMember(validMemberId)).toThrow();
    });
  });

  describe("syncMembers", () => {
    it("メンバーを同期できる", () => {
      const project = Project.create({
        name: "テスト",
        memberIds: [validMemberId],
      });

      const updated = project.syncMembers([validMemberId, validMemberId2]);

      expect(updated.members).toHaveLength(2);
    });

    it("既存メンバーのcreatedAtは保持される", () => {
      const now = new Date();
      const project = Project.reconstruct({
        id: "323e4567-e89b-12d3-a456-426614174002",
        name: "テスト",
        description: null,
        encryptedApiKey: null,
        members: [{ userId: validMemberId, createdAt: now }],
        createdAt: now,
        updatedAt: now,
      });

      const updated = project.syncMembers([validMemberId, validMemberId2]);

      const existingMember = updated.members.find(
        (m) => m.userId.value === validMemberId,
      );
      expect(existingMember?.createdAt.getTime()).toBe(now.getTime());
    });

    it("空のメンバーリストで同期するとエラー", () => {
      const project = Project.create({
        name: "テスト",
        memberIds: [validMemberId],
      });

      expect(() => project.syncMembers([])).toThrow();
    });
  });

  describe("hasMember", () => {
    it("メンバーが存在する場合はtrueを返す", () => {
      const project = Project.create({
        name: "テスト",
        memberIds: [validMemberId],
      });

      expect(project.hasMember(validMemberId)).toBe(true);
    });

    it("メンバーが存在しない場合はfalseを返す", () => {
      const project = Project.create({
        name: "テスト",
        memberIds: [validMemberId],
      });

      expect(project.hasMember(validMemberId2)).toBe(false);
    });
  });

  describe("toDto", () => {
    it("DTOに変換できる", () => {
      const project = Project.create({
        name: "テスト",
        description: "説明",
        apiKey: "key",
        memberIds: [validMemberId],
      });

      const userNameMap = new Map<string, string>();
      userNameMap.set(validMemberId, "テストユーザー");
      const dto = project.toDto(userNameMap);

      expect(dto.id).toBe(project.id.value);
      expect(dto.name).toBe("テスト");
      expect(dto.description).toBe("説明");
      expect(dto.hasApiKey).toBe(true);
      expect(dto.members).toHaveLength(1);
      expect(dto.members[0].userId).toBe(validMemberId);
      expect(dto.members[0].displayName).toBe("テストユーザー");
    });
  });

  describe("toListItemDto", () => {
    it("一覧用DTOに変換できる", () => {
      const project = Project.create({
        name: "テスト",
        description: "説明",
        memberIds: [validMemberId, validMemberId2],
      });

      const userNameMap = new Map<string, string>();
      userNameMap.set(validMemberId, "テストユーザー1");
      userNameMap.set(validMemberId2, "テストユーザー2");
      const dto = project.toListItemDto(userNameMap);

      expect(dto.id).toBe(project.id.value);
      expect(dto.name).toBe("テスト");
      expect(dto.description).toBe("説明");
      expect(dto.memberCount).toBe(2);
      expect(dto.memberPreview).toHaveLength(2);
    });

    it("プレビュー数を指定できる", () => {
      const memberIds = [
        validMemberId,
        validMemberId2,
        "423e4567-e89b-12d3-a456-426614174003",
        "523e4567-e89b-12d3-a456-426614174004",
        "623e4567-e89b-12d3-a456-426614174005",
        "723e4567-e89b-12d3-a456-426614174006",
      ];
      const project = Project.create({
        name: "テスト",
        memberIds,
      });

      const userNameMap = new Map<string, string>();
      memberIds.forEach((id, i) => userNameMap.set(id, `ユーザー${i + 1}`));
      const dto = project.toListItemDto(userNameMap, 3);

      expect(dto.memberCount).toBe(6);
      expect(dto.memberPreview).toHaveLength(3);
    });
  });
});
