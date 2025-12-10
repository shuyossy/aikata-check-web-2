import { describe, it, expect, vi, beforeEach } from "vitest";
import { getLogger } from "../logger";
import { runWithRequestContext } from "../requestContext";

describe("getLogger", () => {
  describe("正常系", () => {
    it("コンテキスト外ではベースロガーを返す", () => {
      const logger = getLogger();

      // ベースロガーが返されることを確認（child()で生成されていない）
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.error).toBe("function");
      expect(typeof logger.debug).toBe("function");
    });

    it("コンテキスト内ではrequestIdとemployeeIdを含むロガーを返す", () => {
      const context = {
        requestId: "test-request-id",
        employeeId: "test-employee-id",
      };

      runWithRequestContext(context, () => {
        const logger = getLogger();

        // ロガーが正しく返されることを確認
        expect(logger).toBeDefined();
        expect(typeof logger.info).toBe("function");

        // bindingsを確認（pinoのchild()で設定された値）
        const bindings = logger.bindings();
        expect(bindings.requestId).toBe("test-request-id");
        expect(bindings.employeeId).toBe("test-employee-id");
      });
    });

    it("employeeIdがない場合はrequestIdのみを含むロガーを返す", () => {
      const context = {
        requestId: "test-request-id-only",
      };

      runWithRequestContext(context, () => {
        const logger = getLogger();
        const bindings = logger.bindings();

        expect(bindings.requestId).toBe("test-request-id-only");
        expect(bindings.employeeId).toBeUndefined();
      });
    });

    it("非同期処理内でもコンテキスト付きロガーを取得できる", async () => {
      const context = {
        requestId: "async-request-id",
        employeeId: "async-employee-id",
      };

      await runWithRequestContext(context, async () => {
        // 非同期処理をシミュレート
        await new Promise((resolve) => setTimeout(resolve, 10));

        const logger = getLogger();
        const bindings = logger.bindings();

        expect(bindings.requestId).toBe("async-request-id");
        expect(bindings.employeeId).toBe("async-employee-id");
      });
    });

    it("コンテキスト終了後はベースロガーに戻る", () => {
      const context = {
        requestId: "temp-request-id",
        employeeId: "temp-employee-id",
      };

      runWithRequestContext(context, () => {
        const loggerInContext = getLogger();
        expect(loggerInContext.bindings().requestId).toBe("temp-request-id");
      });

      // コンテキスト外
      const loggerOutsideContext = getLogger();
      expect(loggerOutsideContext.bindings().requestId).toBeUndefined();
    });
  });
});
