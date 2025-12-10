import { eq, like, or, desc, sql, inArray } from "drizzle-orm";
import {
  IProjectRepository,
  FindProjectsOptions,
} from "@/application/shared/port/repository";
import { Project, ProjectId } from "@/domain/project";
import { UserId } from "@/domain/user";
import { db } from "../index";
import { projects, projectMembers, users } from "@/drizzle/schema";

/**
 * プロジェクトリポジトリ実装
 * Drizzle ORMを使用してPostgreSQLと通信
 */
export class ProjectRepository implements IProjectRepository {
  /**
   * IDでプロジェクトを検索（メンバー情報含む）
   */
  async findById(id: ProjectId): Promise<Project | null> {
    // プロジェクトを取得
    const projectResult = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id.value))
      .limit(1);

    if (projectResult.length === 0) {
      return null;
    }

    const project = projectResult[0];

    // メンバーを取得
    const membersResult = await db
      .select()
      .from(projectMembers)
      .where(eq(projectMembers.projectId, id.value));

    return Project.reconstruct({
      id: project.id,
      name: project.name,
      description: project.description,
      encryptedApiKey: project.encryptedApiKey,
      members: membersResult.map((m) => ({
        userId: m.userId,
        createdAt: m.createdAt,
      })),
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    });
  }

  /**
   * ユーザIDでプロジェクト一覧を検索
   */
  async findByMemberId(
    userId: UserId,
    options?: FindProjectsOptions,
  ): Promise<Project[]> {
    const { search, limit = 100, offset = 0 } = options ?? {};

    // ユーザが所属するプロジェクトIDを取得
    const memberProjectIds = db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(eq(projectMembers.userId, userId.value));

    // プロジェクトを取得
    let query = db
      .select()
      .from(projects)
      .where(inArray(projects.id, memberProjectIds))
      .orderBy(desc(projects.updatedAt))
      .limit(limit)
      .offset(offset);

    // 検索キーワードがある場合はフィルタ
    if (search) {
      query = db
        .select()
        .from(projects)
        .where(
          sql`${projects.id} IN ${memberProjectIds} AND ${projects.name} ILIKE ${"%" + search + "%"}`,
        )
        .orderBy(desc(projects.updatedAt))
        .limit(limit)
        .offset(offset);
    }

    const projectsResult = await query;

    // 各プロジェクトのメンバーを取得
    const projectIds = projectsResult.map((p) => p.id);
    if (projectIds.length === 0) {
      return [];
    }

    const membersResult = await db
      .select()
      .from(projectMembers)
      .where(inArray(projectMembers.projectId, projectIds));

    // メンバーをプロジェクトIDでグループ化
    const membersByProjectId = new Map<
      string,
      { userId: string; createdAt: Date }[]
    >();
    for (const m of membersResult) {
      const members = membersByProjectId.get(m.projectId) ?? [];
      members.push({ userId: m.userId, createdAt: m.createdAt });
      membersByProjectId.set(m.projectId, members);
    }

    return projectsResult.map((p) =>
      Project.reconstruct({
        id: p.id,
        name: p.name,
        description: p.description,
        encryptedApiKey: p.encryptedApiKey,
        members: membersByProjectId.get(p.id) ?? [],
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }),
    );
  }

  /**
   * ユーザIDでプロジェクト数をカウント
   */
  async countByMemberId(userId: UserId, search?: string): Promise<number> {
    // ユーザが所属するプロジェクトIDを取得
    const memberProjectIds = db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(eq(projectMembers.userId, userId.value));

    let query;
    if (search) {
      query = db
        .select({ count: sql<number>`count(*)` })
        .from(projects)
        .where(
          sql`${projects.id} IN ${memberProjectIds} AND ${projects.name} ILIKE ${"%" + search + "%"}`,
        );
    } else {
      query = db
        .select({ count: sql<number>`count(*)` })
        .from(projects)
        .where(inArray(projects.id, memberProjectIds));
    }

    const result = await query;
    return Number(result[0]?.count ?? 0);
  }

  /**
   * プロジェクトを保存（新規作成または更新）
   */
  async save(project: Project): Promise<void> {
    const projectData = {
      id: project.id.value,
      name: project.name.value,
      description: project.description.value,
      encryptedApiKey: project.encryptedApiKey.encryptedValue,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };

    // プロジェクト本体を保存（upsert）
    await db
      .insert(projects)
      .values(projectData)
      .onConflictDoUpdate({
        target: projects.id,
        set: {
          name: projectData.name,
          description: projectData.description,
          encryptedApiKey: projectData.encryptedApiKey,
          updatedAt: projectData.updatedAt,
        },
      });

    // メンバーを同期
    // 既存メンバーを削除
    await db
      .delete(projectMembers)
      .where(eq(projectMembers.projectId, project.id.value));

    // 新しいメンバーを追加
    if (project.members.length > 0) {
      await db.insert(projectMembers).values(
        project.members.map((m) => ({
          projectId: project.id.value,
          userId: m.userId.value,
          createdAt: m.createdAt,
        })),
      );
    }
  }

  /**
   * プロジェクトを削除
   */
  async delete(id: ProjectId): Promise<void> {
    // CASCADE削除なのでプロジェクトを削除するだけでメンバーも削除される
    await db.delete(projects).where(eq(projects.id, id.value));
  }
}
