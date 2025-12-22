import { describe, it, expect } from "vitest";
import { getRequestContext, runWithRequestContext } from "../requestContext";

describe("requestContext", () => {
  describe("getRequestContext", () => {
    describe("正常系", () => {
      it("コンテキスト外ではundefinedを返す", () => {
        const result = getRequestContext();
        expect(result).toBeUndefined();
      });

      it("コンテキスト内では設定した値を返す", () => {
        const context = {
          requestId: "test-request-id",
          employeeId: "test-employee-id",
        };

        runWithRequestContext(context, () => {
          const result = getRequestContext();
          expect(result).toEqual(context);
        });
      });

      it("employeeIdがない場合もrequestIdのみで取得できる", () => {
        const context = {
          requestId: "test-request-id",
        };

        runWithRequestContext(context, () => {
          const result = getRequestContext();
          expect(result?.requestId).toBe("test-request-id");
          expect(result?.employeeId).toBeUndefined();
        });
      });
    });
  });

  describe("runWithRequestContext", () => {
    describe("正常系", () => {
      it("コールバックの戻り値を返す", () => {
        const context = { requestId: "test-id" };
        const result = runWithRequestContext(context, () => "test-result");
        expect(result).toBe("test-result");
      });

      it("非同期処理でもコンテキストが維持される", async () => {
        const context = {
          requestId: "async-test-id",
          employeeId: "async-employee-id",
        };

        await runWithRequestContext(context, async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          const result = getRequestContext();
          expect(result).toEqual(context);
        });
      });

      it("ネストしたコンテキストは内側が優先される", () => {
        const outerContext = { requestId: "outer-id" };
        const innerContext = { requestId: "inner-id", employeeId: "inner-emp" };

        runWithRequestContext(outerContext, () => {
          expect(getRequestContext()?.requestId).toBe("outer-id");

          runWithRequestContext(innerContext, () => {
            expect(getRequestContext()?.requestId).toBe("inner-id");
            expect(getRequestContext()?.employeeId).toBe("inner-emp");
          });

          // 内側のコンテキスト終了後は外側に戻る
          expect(getRequestContext()?.requestId).toBe("outer-id");
          expect(getRequestContext()?.employeeId).toBeUndefined();
        });
      });

      it("コンテキスト終了後はundefinedに戻る", () => {
        const context = { requestId: "test-id" };

        runWithRequestContext(context, () => {
          expect(getRequestContext()).toBeDefined();
        });

        expect(getRequestContext()).toBeUndefined();
      });
    });
  });
});
