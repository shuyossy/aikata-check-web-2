import { describe, it, expect } from "vitest";
import {
  judgeReviewMode,
  buildPlanningChecklistInfo,
  buildResearchChecklistInfo,
  buildAnswerChecklistInfo,
} from "../lib";
import type { ChecklistResultWithIndividual } from "../types";
// チャンク分割関数は @/application/mastra/lib/util.ts を参照
// テストは application/mastra/lib/__tests__/util.test.ts に移動

describe("judgeReviewMode", () => {
  it("individualResultsがない場合はsmallを返す", () => {
    const checklistResults: ChecklistResultWithIndividual[] = [
      {
        checklistResult: {
          id: "check-1",
          content: "項目1",
          evaluation: "A",
          comment: "良好",
        },
        individualResults: undefined,
      },
    ];

    expect(judgeReviewMode(checklistResults)).toBe("small");
  });

  it("individualResultsが空配列の場合はsmallを返す", () => {
    const checklistResults: ChecklistResultWithIndividual[] = [
      {
        checklistResult: {
          id: "check-1",
          content: "項目1",
          evaluation: "A",
          comment: "良好",
        },
        individualResults: [],
      },
    ];

    expect(judgeReviewMode(checklistResults)).toBe("small");
  });

  it("individualResultsがある場合はlargeを返す", () => {
    const checklistResults: ChecklistResultWithIndividual[] = [
      {
        checklistResult: {
          id: "check-1",
          content: "項目1",
          evaluation: "B",
          comment: "一部問題あり",
        },
        individualResults: [
          {
            documentId: "doc-1",
            individualFileName: "part1.docx",
            comment: "Part1のコメント",
          },
        ],
      },
    ];

    expect(judgeReviewMode(checklistResults)).toBe("large");
  });

  it("複数のチェックリストのうち1つでもindividualResultsがあればlargeを返す", () => {
    const checklistResults: ChecklistResultWithIndividual[] = [
      {
        checklistResult: {
          id: "check-1",
          content: "項目1",
          evaluation: "A",
          comment: "良好",
        },
        individualResults: undefined,
      },
      {
        checklistResult: {
          id: "check-2",
          content: "項目2",
          evaluation: "B",
          comment: "問題あり",
        },
        individualResults: [
          {
            documentId: "doc-1",
            individualFileName: "part1.docx",
            comment: "コメント",
          },
        ],
      },
    ];

    expect(judgeReviewMode(checklistResults)).toBe("large");
  });

  it("空配列の場合はsmallを返す", () => {
    expect(judgeReviewMode([])).toBe("small");
  });
});

describe("buildPlanningChecklistInfo", () => {
  it("チェックリスト情報を文字列として構築する", () => {
    const checklistResults: ChecklistResultWithIndividual[] = [
      {
        checklistResult: {
          id: "check-1",
          content: "セキュリティ対策が適切か",
          evaluation: "B",
          comment: "一部不足",
        },
        individualResults: undefined,
      },
    ];

    const result = buildPlanningChecklistInfo(checklistResults);

    expect(result).toContain("Checklist ID: check-1");
    expect(result).toContain("Content: セキュリティ対策が適切か");
    expect(result).toContain("Evaluation: B");
    expect(result).toContain("Comment: 一部不足");
  });

  it("individualResultsがある場合は詳細情報を含める", () => {
    const checklistResults: ChecklistResultWithIndividual[] = [
      {
        checklistResult: {
          id: "check-1",
          content: "セキュリティ対策",
          evaluation: "B",
          comment: "総合コメント",
        },
        individualResults: [
          {
            documentId: "doc-1",
            individualFileName: "part1.docx",
            comment: "Part1のコメント",
          },
          {
            documentId: "doc-2",
            individualFileName: "part2.docx",
            comment: "Part2のコメント",
          },
        ],
      },
    ];

    const result = buildPlanningChecklistInfo(checklistResults);

    expect(result).toContain("Individual Review Results:");
    expect(result).toContain("Document ID: doc-1");
    expect(result).toContain("Document Name: part1.docx");
    expect(result).toContain("Part1のコメント");
    expect(result).toContain("Document ID: doc-2");
    expect(result).toContain("Part2のコメント");
  });

  it("複数のチェックリストを区切り線で区切る", () => {
    const checklistResults: ChecklistResultWithIndividual[] = [
      {
        checklistResult: {
          id: "check-1",
          content: "項目1",
          evaluation: "A",
          comment: "コメント1",
        },
        individualResults: undefined,
      },
      {
        checklistResult: {
          id: "check-2",
          content: "項目2",
          evaluation: "B",
          comment: "コメント2",
        },
        individualResults: undefined,
      },
    ];

    const result = buildPlanningChecklistInfo(checklistResults);

    expect(result).toContain("---");
    expect(result).toContain("Checklist ID: check-1");
    expect(result).toContain("Checklist ID: check-2");
  });

  it("評価やコメントがない場合はN/Aを表示", () => {
    const checklistResults: ChecklistResultWithIndividual[] = [
      {
        checklistResult: {
          id: "check-1",
          content: "項目1",
          evaluation: null,
          comment: null,
        },
        individualResults: undefined,
      },
    ];

    const result = buildPlanningChecklistInfo(checklistResults);

    // 評価とコメントがnullの場合、Review Resultセクションは出力されない
    expect(result).not.toContain("Evaluation:");
  });
});

describe("buildResearchChecklistInfo", () => {
  it("調査用のチェックリスト情報を構築する", () => {
    const checklistResults: ChecklistResultWithIndividual[] = [
      {
        checklistResult: {
          id: "check-1",
          content: "セキュリティ対策",
          evaluation: "B",
          comment: "コメント",
        },
        individualResults: undefined,
      },
    ];

    const result = buildResearchChecklistInfo(checklistResults);

    expect(result).toContain("Checklist ID: check-1");
    expect(result).toContain("Content: セキュリティ対策");
  });
});

describe("buildAnswerChecklistInfo", () => {
  it("回答用のチェックリスト情報を構築する（簡潔形式）", () => {
    const checklistResults: ChecklistResultWithIndividual[] = [
      {
        checklistResult: {
          id: "check-1",
          content: "セキュリティ対策が適切か",
          evaluation: "B",
          comment: "一部不足がある",
        },
        individualResults: undefined,
      },
    ];

    const result = buildAnswerChecklistInfo(checklistResults);

    expect(result).toContain("Checklist: セキュリティ対策が適切か");
    expect(result).toContain("Evaluation: B");
    expect(result).toContain("Comment: 一部不足がある");
    // IDは含まれない（簡潔形式）
    expect(result).not.toContain("Checklist ID:");
    // Individual resultsは含まれない
    expect(result).not.toContain("Individual Review Results:");
  });

  it("複数のチェックリストを改行で区切る", () => {
    const checklistResults: ChecklistResultWithIndividual[] = [
      {
        checklistResult: {
          id: "check-1",
          content: "項目1",
          evaluation: "A",
          comment: "良好",
        },
        individualResults: undefined,
      },
      {
        checklistResult: {
          id: "check-2",
          content: "項目2",
          evaluation: "B",
          comment: "要改善",
        },
        individualResults: undefined,
      },
    ];

    const result = buildAnswerChecklistInfo(checklistResults);
    const lines = result.split("\n");

    expect(lines.some((line) => line.includes("項目1"))).toBe(true);
    expect(lines.some((line) => line.includes("項目2"))).toBe(true);
  });
});
