/**
 * workflowUtils のテスト
 */

import { describe, it, expect } from "vitest";
import { checkWorkflowResult, checkStatuses } from "../workflowUtils";

describe("checkWorkflowResult", () => {
  describe("ワークフロー全体のステータス", () => {
    it("ワークフローがfailedの場合、failedを返す", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = {
        status: "failed" as const,
        error: new Error("ワークフローエラー"),
        input: {},
        steps: {},
      };

      const checkResult = checkWorkflowResult(result);
      expect(checkResult.status).toBe("failed");
      expect(checkResult.errorMessage).toBe("ワークフローエラー");
    });

    it("ワークフローがcanceledの場合、canceledを返す", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = {
        status: "canceled" as const,
        input: {},
        steps: {},
      };

      const checkResult = checkWorkflowResult(result);
      expect(checkResult.status).toBe("canceled");
    });

    it("ワークフローがsuspendedの場合、suspendedを返す", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = {
        status: "suspended" as const,
        input: {},
        steps: {},
        suspendPayload: {},
        suspended: [],
      };

      const checkResult = checkWorkflowResult(result);
      expect(checkResult.status).toBe("suspended");
    });
  });

  describe("ステップのステータス確認", () => {
    it("すべてのステップがsuccessの場合、successを返す", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = {
        status: "success" as const,
        input: {},
        steps: {},
        result: {
          status: "success",
          generatedItems: ["item1", "item2"],
        },
      };

      const checkResult = checkWorkflowResult(result);
      expect(checkResult.status).toBe("success");
    });

    it("ステップがfailedの場合、failedとエラーメッセージを返す", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = {
        status: "success" as const,
        input: {},
        steps: {},
        result: {
          status: "failed",
          errorMessage: "ステップエラー",
        },
      };

      const checkResult = checkWorkflowResult(result);
      expect(checkResult.status).toBe("failed");
      expect(checkResult.errorMessage).toBe("ステップエラー");
    });

    it("ネストされた配列内のfailedを検出する", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = {
        status: "success" as const,
        input: {},
        steps: {},
        result: [
          { status: "success", items: ["item1"] },
          { status: "failed", errorMessage: "2番目のステップでエラー" },
          { status: "success", items: ["item3"] },
        ],
      };

      const checkResult = checkWorkflowResult(result);
      expect(checkResult.status).toBe("failed");
      expect(checkResult.errorMessage).toBe("2番目のステップでエラー");
    });
  });
});

describe("checkStatuses", () => {
  it("空のオブジェクトはすべてパス", () => {
    const result = checkStatuses({});
    expect(result.allPassed).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("successステータスのオブジェクトはパス", () => {
    const result = checkStatuses({
      status: "success",
      data: "some data",
    });
    expect(result.allPassed).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("failedステータスのオブジェクトはエラー", () => {
    const result = checkStatuses({
      status: "failed",
      errorMessage: "テストエラー",
    });
    expect(result.allPassed).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toBe("テストエラー");
  });

  it("ネストされたオブジェクト内のfailedを検出", () => {
    const result = checkStatuses({
      step1: {
        status: "success",
      },
      step2: {
        nested: {
          status: "failed",
          errorMessage: "ネストされたエラー",
        },
      },
    });
    expect(result.allPassed).toBe(false);
    expect(result.errors[0].message).toBe("ネストされたエラー");
  });

  it("配列内のfailedを検出", () => {
    const result = checkStatuses([
      { status: "success" },
      { status: "failed", errorMessage: "配列内のエラー" },
    ]);
    expect(result.allPassed).toBe(false);
    expect(result.errors[0].message).toBe("配列内のエラー");
  });

  it("boolean型のfalseステータスも検出（互換性）", () => {
    const result = checkStatuses({
      status: false,
      errorMessage: "boolean falseエラー",
    });
    expect(result.allPassed).toBe(false);
    expect(result.errors[0].message).toBe("boolean falseエラー");
  });

  it("参照循環を安全に処理", () => {
    const obj: Record<string, unknown> = {
      status: "success",
    };
    obj.self = obj; // 循環参照

    const result = checkStatuses(obj);
    expect(result.allPassed).toBe(true);
  });

  it("複数のエラーを検出", () => {
    const result = checkStatuses({
      step1: { status: "failed", errorMessage: "エラー1" },
      step2: { status: "failed", errorMessage: "エラー2" },
    });
    expect(result.allPassed).toBe(false);
    expect(result.errors).toHaveLength(2);
  });

  it("エラーメッセージがない場合はデフォルトメッセージ", () => {
    const result = checkStatuses({
      status: "failed",
    });
    expect(result.allPassed).toBe(false);
    expect(result.errors[0].message).toBe("Unknown error");
  });
});
