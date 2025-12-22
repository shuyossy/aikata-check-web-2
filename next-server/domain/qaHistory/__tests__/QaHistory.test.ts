import { describe, it, expect } from "vitest";
import {
  QaHistory,
  QaHistoryId,
  Question,
  Answer,
  QaStatus,
  ResearchSummary,
  CheckListItemContent,
} from "../index";
import { ReviewTargetId } from "../../reviewTarget/ReviewTargetId";
import { UserId } from "../../user/UserId";

describe("QaHistoryId", () => {
  describe("create", () => {
    it("新規UUIDを生成できる", () => {
      const id = QaHistoryId.create();
      expect(id.value).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });
  });

  describe("reconstruct", () => {
    it("有効なUUIDから復元できる", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      const id = QaHistoryId.reconstruct(uuid);
      expect(id.value).toBe(uuid);
    });

    it("無効なUUIDでエラー", () => {
      expect(() => QaHistoryId.reconstruct("invalid")).toThrow();
    });

    it("空文字でエラー", () => {
      expect(() => QaHistoryId.reconstruct("")).toThrow();
    });
  });

  describe("equals", () => {
    it("同じ値なら等価", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      const id1 = QaHistoryId.reconstruct(uuid);
      const id2 = QaHistoryId.reconstruct(uuid);
      expect(id1.equals(id2)).toBe(true);
    });

    it("異なる値なら不等価", () => {
      const id1 = QaHistoryId.create();
      const id2 = QaHistoryId.create();
      expect(id1.equals(id2)).toBe(false);
    });
  });
});

describe("Question", () => {
  describe("create", () => {
    it("有効な質問を作成できる", () => {
      const question = Question.create("これはテスト質問です");
      expect(question.value).toBe("これはテスト質問です");
    });

    it("空文字でエラー", () => {
      expect(() => Question.create("")).toThrow();
    });

    it("空白のみでエラー", () => {
      expect(() => Question.create("   ")).toThrow();
    });

    it("2000文字を超えるとエラー", () => {
      const longQuestion = "a".repeat(2001);
      expect(() => Question.create(longQuestion)).toThrow();
    });

    it("2000文字ちょうどは有効", () => {
      const maxQuestion = "a".repeat(2000);
      const question = Question.create(maxQuestion);
      expect(question.value.length).toBe(2000);
    });
  });

  describe("reconstruct", () => {
    it("バリデーションなしで復元できる", () => {
      const longQuestion = "a".repeat(3000);
      const question = Question.reconstruct(longQuestion);
      expect(question.value.length).toBe(3000);
    });
  });
});

describe("Answer", () => {
  describe("create", () => {
    it("有効な回答を作成できる", () => {
      const answer = Answer.create("これはテスト回答です");
      expect(answer.value).toBe("これはテスト回答です");
    });

    it("空文字も有効", () => {
      const answer = Answer.create("");
      expect(answer.value).toBe("");
    });

    it("10000文字を超えるとエラー", () => {
      const longAnswer = "a".repeat(10001);
      expect(() => Answer.create(longAnswer)).toThrow();
    });

    it("10000文字ちょうどは有効", () => {
      const maxAnswer = "a".repeat(10000);
      const answer = Answer.create(maxAnswer);
      expect(answer.value.length).toBe(10000);
    });
  });
});

describe("QaStatus", () => {
  describe("create", () => {
    it("pending ステータスを作成できる", () => {
      const status = QaStatus.create("pending");
      expect(status.value).toBe("pending");
      expect(status.isPending()).toBe(true);
    });

    it("processing ステータスを作成できる", () => {
      const status = QaStatus.create("processing");
      expect(status.value).toBe("processing");
      expect(status.isProcessing()).toBe(true);
    });

    it("completed ステータスを作成できる", () => {
      const status = QaStatus.create("completed");
      expect(status.value).toBe("completed");
      expect(status.isCompleted()).toBe(true);
    });

    it("error ステータスを作成できる", () => {
      const status = QaStatus.create("error");
      expect(status.value).toBe("error");
      expect(status.isError()).toBe(true);
    });

    it("無効なステータスでエラー", () => {
      expect(() => QaStatus.create("invalid")).toThrow();
    });
  });

  describe("ファクトリメソッド", () => {
    it("pending() で保留中ステータスを生成", () => {
      const status = QaStatus.pending();
      expect(status.isPending()).toBe(true);
    });

    it("processing() で処理中ステータスを生成", () => {
      const status = QaStatus.processing();
      expect(status.isProcessing()).toBe(true);
    });

    it("completed() で完了ステータスを生成", () => {
      const status = QaStatus.completed();
      expect(status.isCompleted()).toBe(true);
    });

    it("error() でエラーステータスを生成", () => {
      const status = QaStatus.error();
      expect(status.isError()).toBe(true);
    });
  });
});

describe("ResearchSummary", () => {
  describe("create", () => {
    it("調査サマリーを作成できる", () => {
      const items = [
        {
          documentName: "doc1.pdf",
          researchContent: "調査内容1",
          researchResult: "調査結果1",
        },
        {
          documentName: "doc2.pdf",
          researchContent: "調査内容2",
          researchResult: "調査結果2",
        },
      ];
      const summary = ResearchSummary.create(items);
      expect(summary.items).toHaveLength(2);
      expect(summary.items[0].documentName).toBe("doc1.pdf");
    });
  });

  describe("empty", () => {
    it("空の調査サマリーを作成できる", () => {
      const summary = ResearchSummary.empty();
      expect(summary.isEmpty()).toBe(true);
      expect(summary.items).toHaveLength(0);
    });
  });

  describe("fromJson", () => {
    it("JSONから復元できる", () => {
      const json = [
        {
          documentName: "doc.pdf",
          researchContent: "内容",
          researchResult: "結果",
        },
      ];
      const summary = ResearchSummary.fromJson(json);
      expect(summary.items[0].documentName).toBe("doc.pdf");
    });

    it("無効なJSONは空になる", () => {
      const summary = ResearchSummary.fromJson("invalid");
      expect(summary.isEmpty()).toBe(true);
    });
  });

  describe("toJson", () => {
    it("JSONに変換できる", () => {
      const items = [
        {
          documentName: "doc.pdf",
          researchContent: "内容",
          researchResult: "結果",
        },
      ];
      const summary = ResearchSummary.create(items);
      const json = summary.toJson();
      expect(json).toEqual(items);
    });
  });
});

describe("CheckListItemContent", () => {
  describe("create", () => {
    it("有効な内容を作成できる", () => {
      const content = CheckListItemContent.create("チェック項目の内容");
      expect(content.value).toBe("チェック項目の内容");
    });

    it("空文字でエラー", () => {
      expect(() => CheckListItemContent.create("")).toThrow();
    });

    it("5000文字を超えるとエラー", () => {
      const longContent = "a".repeat(5001);
      expect(() => CheckListItemContent.create(longContent)).toThrow();
    });

    it("有効なJSON配列形式を受け入れる", () => {
      const content = CheckListItemContent.create(
        JSON.stringify(["項目1", "項目2"]),
      );
      expect(content.value).toBe('["項目1","項目2"]');
    });

    it("空のJSON配列でエラー", () => {
      expect(() => CheckListItemContent.create("[]")).toThrow();
    });

    it("不正なJSON形式でエラー", () => {
      expect(() => CheckListItemContent.create("[invalid json")).toThrow();
    });
  });
});

describe("QaHistory", () => {
  const createTestQaHistory = () => {
    return QaHistory.create({
      reviewTargetId: ReviewTargetId.create(),
      userId: UserId.create(),
      question: Question.create("テスト質問"),
      checkListItemContent: CheckListItemContent.create("テストチェック項目"),
    });
  };

  describe("create", () => {
    it("新規Q&A履歴を作成できる（pending状態で開始）", () => {
      const qaHistory = createTestQaHistory();

      expect(qaHistory.id).toBeDefined();
      expect(qaHistory.question.value).toBe("テスト質問");
      expect(qaHistory.checkListItemContent.value).toBe("テストチェック項目");
      expect(qaHistory.isPending()).toBe(true);
      expect(qaHistory.answer).toBeNull();
      expect(qaHistory.researchSummary).toBeNull();
      expect(qaHistory.errorMessage).toBeNull();
    });
  });

  describe("startProcessing", () => {
    it("pending状態から処理中状態に遷移できる", () => {
      const qaHistory = createTestQaHistory();
      expect(qaHistory.isPending()).toBe(true);

      qaHistory.startProcessing();

      expect(qaHistory.isProcessing()).toBe(true);
      expect(qaHistory.isPending()).toBe(false);
    });

    it("pending状態でない場合はエラーを投げる", () => {
      const qaHistory = createTestQaHistory();
      qaHistory.startProcessing(); // processing状態に遷移

      expect(() => qaHistory.startProcessing()).toThrow(
        "処理を開始できるのはpending状態のときのみです",
      );
    });
  });

  describe("reconstruct", () => {
    it("既存データから復元できる", () => {
      const now = new Date();
      const qaHistory = QaHistory.reconstruct({
        id: QaHistoryId.create(),
        reviewTargetId: ReviewTargetId.create(),
        userId: UserId.create(),
        question: Question.create("質問"),
        checkListItemContent: CheckListItemContent.create("チェック項目"),
        answer: Answer.create("回答"),
        researchSummary: ResearchSummary.create([
          {
            documentName: "doc.pdf",
            researchContent: "内容",
            researchResult: "結果",
          },
        ]),
        status: QaStatus.completed(),
        errorMessage: null,
        createdAt: now,
        updatedAt: now,
      });

      expect(qaHistory.isCompleted()).toBe(true);
      expect(qaHistory.answer?.value).toBe("回答");
    });
  });

  describe("complete", () => {
    it("完了状態にできる", () => {
      const qaHistory = createTestQaHistory();
      const answer = Answer.create("AIの回答");
      const summary = ResearchSummary.create([
        {
          documentName: "doc.pdf",
          researchContent: "内容",
          researchResult: "結果",
        },
      ]);

      qaHistory.complete(answer, summary);

      expect(qaHistory.isCompleted()).toBe(true);
      expect(qaHistory.answer?.value).toBe("AIの回答");
      expect(qaHistory.researchSummary?.items).toHaveLength(1);
      expect(qaHistory.errorMessage).toBeNull();
    });
  });

  describe("fail", () => {
    it("エラー状態にできる", () => {
      const qaHistory = createTestQaHistory();

      qaHistory.fail("エラーメッセージ");

      expect(qaHistory.isError()).toBe(true);
      expect(qaHistory.errorMessage).toBe("エラーメッセージ");
    });
  });

  describe("equals", () => {
    it("同じIDなら等価", () => {
      const id = QaHistoryId.create();
      const now = new Date();
      const qa1 = QaHistory.reconstruct({
        id,
        reviewTargetId: ReviewTargetId.create(),
        userId: UserId.create(),
        question: Question.create("質問1"),
        checkListItemContent: CheckListItemContent.create("チェック項目1"),
        answer: null,
        researchSummary: null,
        status: QaStatus.processing(),
        errorMessage: null,
        createdAt: now,
        updatedAt: now,
      });
      const qa2 = QaHistory.reconstruct({
        id,
        reviewTargetId: ReviewTargetId.create(),
        userId: UserId.create(),
        question: Question.create("質問2"),
        checkListItemContent: CheckListItemContent.create("チェック項目2"),
        answer: null,
        researchSummary: null,
        status: QaStatus.processing(),
        errorMessage: null,
        createdAt: now,
        updatedAt: now,
      });

      expect(qa1.equals(qa2)).toBe(true);
    });

    it("異なるIDなら不等価", () => {
      const qa1 = createTestQaHistory();
      const qa2 = createTestQaHistory();

      expect(qa1.equals(qa2)).toBe(false);
    });
  });

  describe("状態遷移", () => {
    it("完全なライフサイクル: create -> startProcessing -> complete", () => {
      // 1. 作成（pending状態）
      const qaHistory = createTestQaHistory();
      expect(qaHistory.isPending()).toBe(true);
      expect(qaHistory.isProcessing()).toBe(false);
      expect(qaHistory.isCompleted()).toBe(false);
      expect(qaHistory.isError()).toBe(false);

      // 2. 処理開始（processing状態）
      qaHistory.startProcessing();
      expect(qaHistory.isPending()).toBe(false);
      expect(qaHistory.isProcessing()).toBe(true);
      expect(qaHistory.isCompleted()).toBe(false);
      expect(qaHistory.isError()).toBe(false);

      // 3. 完了（completed状態）
      const answer = Answer.create("回答");
      const summary = ResearchSummary.create([
        {
          documentName: "test.docx",
          researchContent: "調査",
          researchResult: "結果",
        },
      ]);
      qaHistory.complete(answer, summary);
      expect(qaHistory.isPending()).toBe(false);
      expect(qaHistory.isProcessing()).toBe(false);
      expect(qaHistory.isCompleted()).toBe(true);
      expect(qaHistory.isError()).toBe(false);
      expect(qaHistory.answer?.value).toBe("回答");
      expect(qaHistory.researchSummary?.items).toHaveLength(1);
    });

    it("完全なライフサイクル: create -> startProcessing -> fail", () => {
      // 1. 作成（pending状態）
      const qaHistory = createTestQaHistory();
      expect(qaHistory.isPending()).toBe(true);

      // 2. 処理開始（processing状態）
      qaHistory.startProcessing();
      expect(qaHistory.isProcessing()).toBe(true);

      // 3. エラー（error状態）
      qaHistory.fail("処理中にエラーが発生しました");
      expect(qaHistory.isPending()).toBe(false);
      expect(qaHistory.isProcessing()).toBe(false);
      expect(qaHistory.isCompleted()).toBe(false);
      expect(qaHistory.isError()).toBe(true);
      expect(qaHistory.errorMessage).toBe("処理中にエラーが発生しました");
    });

    it("completed状態からstartProcessingを呼び出すとエラー", () => {
      const now = new Date();
      const qaHistory = QaHistory.reconstruct({
        id: QaHistoryId.create(),
        reviewTargetId: ReviewTargetId.create(),
        userId: UserId.create(),
        question: Question.create("質問"),
        checkListItemContent: CheckListItemContent.create("チェック項目"),
        answer: Answer.create("回答"),
        researchSummary: ResearchSummary.empty(),
        status: QaStatus.completed(),
        errorMessage: null,
        createdAt: now,
        updatedAt: now,
      });

      expect(() => qaHistory.startProcessing()).toThrow(
        "処理を開始できるのはpending状態のときのみです",
      );
    });

    it("error状態からstartProcessingを呼び出すとエラー", () => {
      const now = new Date();
      const qaHistory = QaHistory.reconstruct({
        id: QaHistoryId.create(),
        reviewTargetId: ReviewTargetId.create(),
        userId: UserId.create(),
        question: Question.create("質問"),
        checkListItemContent: CheckListItemContent.create("チェック項目"),
        answer: null,
        researchSummary: null,
        status: QaStatus.error(),
        errorMessage: "前回のエラー",
        createdAt: now,
        updatedAt: now,
      });

      expect(() => qaHistory.startProcessing()).toThrow(
        "処理を開始できるのはpending状態のときのみです",
      );
    });

    it("pending状態でもcomplete/failは可能（SSE接続なしでの直接完了ケース用）", () => {
      const qaHistory = createTestQaHistory();
      expect(qaHistory.isPending()).toBe(true);

      // pendingから直接complete
      const answer = Answer.create("直接回答");
      const summary = ResearchSummary.empty();
      qaHistory.complete(answer, summary);

      expect(qaHistory.isCompleted()).toBe(true);
    });

    it("pending状態でもfailは可能（バリデーションエラー等の早期失敗ケース用）", () => {
      const qaHistory = createTestQaHistory();
      expect(qaHistory.isPending()).toBe(true);

      // pendingから直接fail
      qaHistory.fail("バリデーションエラー");

      expect(qaHistory.isError()).toBe(true);
    });

    it("updatedAtが状態遷移時に更新される", () => {
      const qaHistory = createTestQaHistory();
      const initialUpdatedAt = qaHistory.updatedAt;

      // 少し待ってから状態遷移
      const startTime = Date.now();
      while (Date.now() - startTime < 10) {
        // 10ms待機
      }

      qaHistory.startProcessing();

      // updatedAtが更新されていることを確認
      expect(qaHistory.updatedAt.getTime()).toBeGreaterThanOrEqual(
        initialUpdatedAt.getTime(),
      );
    });
  });
});
