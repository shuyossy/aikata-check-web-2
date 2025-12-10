import { describe, it, expect } from "vitest";
import {
  AppError,
  internalError,
  unauthorizedError,
  validationParamError,
  domainValidationError,
  normalizeUnknownError,
  toPayload,
} from "../error";

describe("AppError", () => {
  describe("正常系", () => {
    it("AppErrorを正しく生成できる", () => {
      const error = new AppError("INTERNAL", {
        expose: true,
        messageCode: "UNKNOWN_ERROR",
      });

      expect(error.errorCode).toBe("INTERNAL");
      expect(error.expose).toBe(true);
      expect(error.messageCode).toBe("UNKNOWN_ERROR");
    });

    it("exposeがtrueの場合はメッセージが表示される", () => {
      const error = new AppError("INTERNAL", {
        expose: true,
        messageCode: "UNKNOWN_ERROR",
      });

      expect(error.message).toBe("予期せぬエラーが発生しました。");
    });

    it("exposeがfalseの場合はデフォルトメッセージが表示される", () => {
      const error = new AppError("INTERNAL", {
        expose: false,
        // messageCodeを指定しない場合はUNKNOWN_ERRORがデフォルト
      });

      // expose: falseの場合、message getterでUNKNOWN_ERRORのメッセージが返る
      expect(error.message).toBe("予期せぬエラーが発生しました。");
    });
  });
});

describe("internalError", () => {
  describe("正常系", () => {
    it("デフォルトでexposeがfalseになる", () => {
      const error = internalError();

      expect(error.errorCode).toBe("INTERNAL");
      expect(error.expose).toBe(false);
    });

    it("expose: trueを指定できる", () => {
      const error = internalError({ expose: true });

      expect(error.expose).toBe(true);
    });

    it("messageCodeを指定できる", () => {
      const error = internalError({
        expose: true,
        messageCode: "USER_SYNC_FAILED",
      });

      expect(error.messageCode).toBe("USER_SYNC_FAILED");
      expect(error.message).toBe(
        "システムに問題が発生しており、ログイン処理を完了できません",
      );
    });

    it("causeを指定できる", () => {
      const originalError = new Error("Original error");
      const error = internalError({
        expose: true,
        cause: originalError,
      });

      expect(error.couse).toBe(originalError);
    });
  });

  describe("異常系テスト（Server Actionsで使用されるパターン）", () => {
    it("User not foundエラーをinternalErrorで正しく生成できる", () => {
      // Server Actionsで使用されるパターン
      const error = internalError({
        expose: true,
        messageCode: "USER_SYNC_FAILED",
      });

      expect(error.errorCode).toBe("INTERNAL");
      expect(error.expose).toBe(true);
      expect(error.messageCode).toBe("USER_SYNC_FAILED");
      expect(error.message).toBe(
        "システムに問題が発生しており、ログイン処理を完了できません",
      );
    });
  });
});

describe("unauthorizedError", () => {
  it("認証エラーを正しく生成できる", () => {
    const error = unauthorizedError();

    expect(error.errorCode).toBe("UNAUTHORIZED");
    expect(error.expose).toBe(true);
    expect(error.messageCode).toBe("UNAUTHORIZED_ERROR");
    expect(error.message).toBe("認証されていません。ログインが必要です。");
  });
});

describe("validationParamError", () => {
  it("バリデーションエラーを正しく生成できる", () => {
    const error = validationParamError("名前は必須です");

    expect(error.errorCode).toBe("VALIDATION");
    expect(error.expose).toBe(true);
    expect(error.message).toContain("名前は必須です");
  });
});

describe("domainValidationError", () => {
  it("ドメインバリデーションエラーを正しく生成できる", () => {
    const error = domainValidationError("PROJECT_NAME_EMPTY");

    expect(error.errorCode).toBe("DOMAIN_VALIDATION_ERROR");
    expect(error.expose).toBe(true);
    expect(error.message).toBe("プロジェクト名は必須です。");
  });
});

describe("normalizeUnknownError", () => {
  describe("正常系", () => {
    it("AppErrorはそのまま返される", () => {
      const originalError = internalError({ expose: true });
      const result = normalizeUnknownError(originalError);

      expect(result).toBe(originalError);
    });

    it("通常のErrorはINTERNALエラーに変換される", () => {
      const originalError = new Error("Some error");
      const result = normalizeUnknownError(originalError);

      expect(result.errorCode).toBe("INTERNAL");
      expect(result.expose).toBe(false);
    });

    it("文字列はINTERNALエラーに変換される", () => {
      const result = normalizeUnknownError("error string");

      expect(result.errorCode).toBe("INTERNAL");
      expect(result.expose).toBe(false);
    });
  });

  describe("異常系", () => {
    it("undefinedはINTERNALエラーに変換される", () => {
      const result = normalizeUnknownError(undefined);

      expect(result.errorCode).toBe("INTERNAL");
      expect(result.expose).toBe(false);
    });

    it("nullはINTERNALエラーに変換される", () => {
      const result = normalizeUnknownError(null);

      expect(result.errorCode).toBe("INTERNAL");
      expect(result.expose).toBe(false);
    });
  });
});

describe("toPayload", () => {
  it("AppErrorをクライアント用ペイロードに変換できる", () => {
    const error = internalError({
      expose: true,
      messageCode: "USER_SYNC_FAILED",
    });
    const payload = toPayload(error);

    expect(payload.code).toBe("INTERNAL");
    expect(payload.message).toBe(
      "システムに問題が発生しており、ログイン処理を完了できません",
    );
  });

  it("exposeがfalseの場合はデフォルトメッセージが返る", () => {
    const error = internalError({ expose: false });
    const payload = toPayload(error);

    expect(payload.code).toBe("INTERNAL");
    expect(payload.message).toBe("予期せぬエラーが発生しました。");
  });
});
