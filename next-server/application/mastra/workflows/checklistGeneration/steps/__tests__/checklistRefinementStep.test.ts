import { describe, it, expect, vi, beforeEach } from "vitest";
import { RuntimeContext } from "@mastra/core/di";
import { checklistRefinementStep } from "../checklistRefinementStep";

// エージェントのモック
const mockGenerateLegacy = vi.fn();

vi.mock("../../../../agents", () => ({
  checklistRefinementAgent: {
    generateLegacy: (...args: unknown[]) => mockGenerateLegacy(...args),
  },
  checklistRefinementOutputSchema: {
    parse: vi.fn((v: unknown) => v),
  },
}));

// loggerをモック
vi.mock("@/lib/server/logger", () => ({
  getLogger: vi.fn().mockReturnValue({
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe("checklistRefinementStep", () => {
  // テストデータ
  const testSystemChecklists = [
    "チェック項目1: セキュリティ要件を確認する",
    "チェック項目2: セキュリティ要件が満たされているか",
    "チェック項目3: データ保護の確認",
  ];

  const testChecklistRequirements = "セキュリティに関するチェックリストを作成";

  // RuntimeContextを作成するヘルパー関数
  const createTestRuntimeContext = () => {
    const runtimeContext = new RuntimeContext();
    runtimeContext.set("employeeId", "test-user-id");
    runtimeContext.set("aiApiKey", "test-api-key");
    return runtimeContext;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系", () => {
    it("チェックリスト項目を正常にブラッシュアップする", async () => {
      // Arrange
      mockGenerateLegacy.mockResolvedValue({
        object: {
          refinedChecklists: [
            "セキュリティ要件の確認と検証",
            "データ保護の確認",
          ],
        },
      });

      // Act
      const result = await checklistRefinementStep.execute({
        inputData: {
          systemChecklists: testSystemChecklists,
          checklistRequirements: testChecklistRequirements,
        },
        runtimeContext: createTestRuntimeContext(),
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: vi.fn(),
      } as any);

      // Assert
      expect(result.status).toBe("success");
      expect(result.refinedItems).toHaveLength(2);
      expect(result.refinedItems).toContain("セキュリティ要件の確認と検証");
      expect(result.refinedItems).toContain("データ保護の確認");
    });

    it("空のチェックリストの場合は空配列を返す", async () => {
      // Act
      const result = await checklistRefinementStep.execute({
        inputData: {
          systemChecklists: [],
          checklistRequirements: testChecklistRequirements,
        },
        runtimeContext: createTestRuntimeContext(),
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: vi.fn(),
      } as any);

      // Assert
      expect(result.status).toBe("success");
      expect(result.refinedItems).toHaveLength(0);
      expect(mockGenerateLegacy).not.toHaveBeenCalled();
    });

    it("checklistRequirementsがRuntimeContextに設定される", async () => {
      // Arrange
      mockGenerateLegacy.mockResolvedValue({
        object: {
          refinedChecklists: ["ブラッシュアップ後の項目"],
        },
      });

      // Act
      await checklistRefinementStep.execute({
        inputData: {
          systemChecklists: testSystemChecklists,
          checklistRequirements: testChecklistRequirements,
        },
        runtimeContext: createTestRuntimeContext(),
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: vi.fn(),
      } as any);

      // Assert
      const callArgs = mockGenerateLegacy.mock.calls[0];
      const options = callArgs[1];
      expect(options.runtimeContext.get("checklistRequirements")).toBe(
        testChecklistRequirements,
      );
    });

    it("userプロンプトにチェックリスト項目が含まれる", async () => {
      // Arrange
      mockGenerateLegacy.mockResolvedValue({
        object: {
          refinedChecklists: ["ブラッシュアップ後の項目"],
        },
      });

      // Act
      await checklistRefinementStep.execute({
        inputData: {
          systemChecklists: testSystemChecklists,
          checklistRequirements: testChecklistRequirements,
        },
        runtimeContext: createTestRuntimeContext(),
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: vi.fn(),
      } as any);

      // Assert
      const callArgs = mockGenerateLegacy.mock.calls[0];
      const message = callArgs[0];
      expect(message.content).toContain("ORIGINAL CHECKLIST ITEMS TO REFINE");
      expect(message.content).toContain("1. チェック項目1");
      expect(message.content).toContain("2. チェック項目2");
      expect(message.content).toContain("3. チェック項目3");
    });

    it("employeeIdとaiApiKeyがRuntimeContextから継承される", async () => {
      // Arrange
      mockGenerateLegacy.mockResolvedValue({
        object: {
          refinedChecklists: ["ブラッシュアップ後の項目"],
        },
      });

      // Act
      await checklistRefinementStep.execute({
        inputData: {
          systemChecklists: testSystemChecklists,
          checklistRequirements: testChecklistRequirements,
        },
        runtimeContext: createTestRuntimeContext(),
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: vi.fn(),
      } as any);

      // Assert
      const callArgs = mockGenerateLegacy.mock.calls[0];
      const options = callArgs[1];
      expect(options.runtimeContext.get("employeeId")).toBe("test-user-id");
      expect(options.runtimeContext.get("aiApiKey")).toBe("test-api-key");
    });

    it("checklistRequirementsがoptionalの場合も正常に動作する", async () => {
      // Arrange
      mockGenerateLegacy.mockResolvedValue({
        object: {
          refinedChecklists: ["ブラッシュアップ後の項目"],
        },
      });

      // Act
      const result = await checklistRefinementStep.execute({
        inputData: {
          systemChecklists: testSystemChecklists,
          // checklistRequirements を省略
        },
        runtimeContext: createTestRuntimeContext(),
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: vi.fn(),
      } as any);

      // Assert
      expect(result.status).toBe("success");
      expect(result.refinedItems).toHaveLength(1);
    });
  });

  describe("異常系", () => {
    it("AI APIエラー時はnormalizeUnknownErrorで処理される", async () => {
      // Arrange
      mockGenerateLegacy.mockRejectedValue(new Error("API呼び出しエラー"));

      // Act
      const result = await checklistRefinementStep.execute({
        inputData: {
          systemChecklists: testSystemChecklists,
          checklistRequirements: testChecklistRequirements,
        },
        runtimeContext: createTestRuntimeContext(),
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: vi.fn(),
      } as any);

      // Assert
      expect(result.status).toBe("failed");
      expect(result.errorMessage).toBeDefined();
    });

    it("RuntimeContextがundefinedでも動作する", async () => {
      // Arrange
      mockGenerateLegacy.mockResolvedValue({
        object: {
          refinedChecklists: ["ブラッシュアップ後の項目"],
        },
      });

      // Act
      const result = await checklistRefinementStep.execute({
        inputData: {
          systemChecklists: testSystemChecklists,
          checklistRequirements: testChecklistRequirements,
        },
        runtimeContext: undefined,
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: vi.fn(),
      } as any);

      // Assert
      expect(result.status).toBe("success");
      // employeeIdとaiApiKeyはundefinedになる
      const callArgs = mockGenerateLegacy.mock.calls[0];
      const options = callArgs[1];
      expect(options.runtimeContext.get("employeeId")).toBeUndefined();
      expect(options.runtimeContext.get("aiApiKey")).toBeUndefined();
    });

    it("refinedChecklistsがundefinedの場合も正常に動作する", async () => {
      // Arrange
      mockGenerateLegacy.mockResolvedValue({
        object: {
          refinedChecklists: undefined,
        },
      });

      // Act
      const result = await checklistRefinementStep.execute({
        inputData: {
          systemChecklists: testSystemChecklists,
          checklistRequirements: testChecklistRequirements,
        },
        runtimeContext: createTestRuntimeContext(),
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: vi.fn(),
      } as any);

      // Assert
      expect(result.status).toBe("success");
      expect(result.refinedItems).toHaveLength(0);
    });
  });

  describe("トークン上限対策のループ処理", () => {
    it("experimental_repairTextが呼ばれた場合にループが継続する", async () => {
      // Arrange
      let callCount = 0;

      mockGenerateLegacy.mockImplementation(async (_message, options) => {
        callCount++;
        if (callCount === 1) {
          // 1回目: experimental_repairTextを呼び出し（トークン上限に達したシミュレーション）
          const repaired = await options.experimental_repairText({
            text: '{"refinedChecklists":["項目1","項目2"',
          });
          return { object: JSON.parse(repaired) };
        }
        // 2回目: 正常終了
        return {
          object: {
            refinedChecklists: ["項目3"],
          },
        };
      });

      // Act
      const result = await checklistRefinementStep.execute({
        inputData: {
          systemChecklists: testSystemChecklists,
          checklistRequirements: testChecklistRequirements,
        },
        runtimeContext: createTestRuntimeContext(),
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: vi.fn(),
      } as any);

      // Assert
      expect(result.status).toBe("success");
      expect(callCount).toBe(2);
      // 蓄積されたアイテムを確認
      expect(result.refinedItems).toContain("項目1");
      expect(result.refinedItems).toContain("項目2");
      expect(result.refinedItems).toContain("項目3");
    });

    it("experimental_repairTextで末尾が]の場合も正しく処理される", async () => {
      // Arrange
      let callCount = 0;

      mockGenerateLegacy.mockImplementation(async (_message, options) => {
        callCount++;
        if (callCount === 1) {
          const repaired = await options.experimental_repairText({
            text: '{"refinedChecklists":["項目1","項目2"]',
          });
          return { object: JSON.parse(repaired) };
        }
        return {
          object: {
            refinedChecklists: [],
          },
        };
      });

      // Act
      const result = await checklistRefinementStep.execute({
        inputData: {
          systemChecklists: testSystemChecklists,
          checklistRequirements: testChecklistRequirements,
        },
        runtimeContext: createTestRuntimeContext(),
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: vi.fn(),
      } as any);

      // Assert
      expect(result.status).toBe("success");
      expect(result.refinedItems).toContain("項目1");
      expect(result.refinedItems).toContain("項目2");
    });

    it("experimental_repairTextで末尾がカンマの場合も正しく処理される", async () => {
      // Arrange
      let callCount = 0;

      mockGenerateLegacy.mockImplementation(async (_message, options) => {
        callCount++;
        if (callCount === 1) {
          const repaired = await options.experimental_repairText({
            text: '{"refinedChecklists":["項目1","項目2",',
          });
          return { object: JSON.parse(repaired) };
        }
        return {
          object: {
            refinedChecklists: [],
          },
        };
      });

      // Act
      const result = await checklistRefinementStep.execute({
        inputData: {
          systemChecklists: testSystemChecklists,
          checklistRequirements: testChecklistRequirements,
        },
        runtimeContext: createTestRuntimeContext(),
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: vi.fn(),
      } as any);

      // Assert
      expect(result.status).toBe("success");
      expect(result.refinedItems).toContain("項目1");
      expect(result.refinedItems).toContain("項目2");
    });

    it("experimental_repairTextで不完全なテキストの場合最後の項目を削除する", async () => {
      // Arrange
      let callCount = 0;

      mockGenerateLegacy.mockImplementation(async (_message, options) => {
        callCount++;
        if (callCount === 1) {
          // 末尾が不完全な文字列（途中で切れている）
          const repaired = await options.experimental_repairText({
            text: '{"refinedChecklists":["項目1","項目2","不完全な項目',
          });
          return { object: JSON.parse(repaired) };
        }
        return {
          object: {
            refinedChecklists: [],
          },
        };
      });

      // Act
      const result = await checklistRefinementStep.execute({
        inputData: {
          systemChecklists: testSystemChecklists,
          checklistRequirements: testChecklistRequirements,
        },
        runtimeContext: createTestRuntimeContext(),
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: vi.fn(),
      } as any);

      // Assert
      expect(result.status).toBe("success");
      expect(result.refinedItems).toContain("項目1");
      expect(result.refinedItems).toContain("項目2");
      // 不完全な項目は削除されている
      expect(result.refinedItems).not.toContain("不完全な項目");
    });

    it("experimental_repairTextでJSON解析に失敗した場合エラーを返す", async () => {
      // Arrange
      mockGenerateLegacy.mockImplementation(async (_message, options) => {
        // 修復不可能な不正なJSONをシミュレート
        await options.experimental_repairText({
          text: "これはJSONではありません",
        });
        return { object: {} };
      });

      // Act
      const result = await checklistRefinementStep.execute({
        inputData: {
          systemChecklists: testSystemChecklists,
          checklistRequirements: testChecklistRequirements,
        },
        runtimeContext: createTestRuntimeContext(),
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: vi.fn(),
      } as any);

      // Assert
      expect(result.status).toBe("failed");
      // normalizeUnknownErrorにより一般的なErrorはデフォルトメッセージに変換される
      expect(result.errorMessage).toBeDefined();
    });

    it("最大試行回数を超えた場合エラーを返す", async () => {
      // Arrange
      mockGenerateLegacy.mockImplementation(async (_message, options) => {
        // 毎回experimental_repairTextを呼び出し続ける
        const repaired = await options.experimental_repairText({
          text: '{"refinedChecklists":["項目1"',
        });
        return { object: JSON.parse(repaired) };
      });

      // Act
      const result = await checklistRefinementStep.execute({
        inputData: {
          systemChecklists: testSystemChecklists,
          checklistRequirements: testChecklistRequirements,
        },
        runtimeContext: createTestRuntimeContext(),
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: vi.fn(),
      } as any);

      // Assert
      expect(result.status).toBe("failed");
      // normalizeUnknownErrorにより一般的なErrorはデフォルトメッセージに変換される
      expect(result.errorMessage).toBeDefined();
      // 最大5回呼ばれる
      expect(mockGenerateLegacy).toHaveBeenCalledTimes(5);
    });

    it("2回目のループでユーザプロンプトに既存のrefinedItemsが含まれる", async () => {
      // Arrange
      let callCount = 0;

      mockGenerateLegacy.mockImplementation(async (_message, options) => {
        callCount++;
        if (callCount === 1) {
          const repaired = await options.experimental_repairText({
            text: '{"refinedChecklists":["項目1"',
          });
          return { object: JSON.parse(repaired) };
        }
        return {
          object: {
            refinedChecklists: ["項目2"],
          },
        };
      });

      // Act
      await checklistRefinementStep.execute({
        inputData: {
          systemChecklists: testSystemChecklists,
          checklistRequirements: testChecklistRequirements,
        },
        runtimeContext: createTestRuntimeContext(),
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: vi.fn(),
      } as any);

      // Assert
      // 2回目の呼び出しのプロンプトを確認
      const secondCallArgs = mockGenerateLegacy.mock.calls[1];
      const message = secondCallArgs[0];
      expect(message.content).toContain("ALREADY REFINED ITEMS");
      expect(message.content).toContain("1. 項目1");
      expect(message.content).toContain(
        "Please continue refining the remaining items",
      );
    });

    it("重複する項目は蓄積時に除外される", async () => {
      // Arrange
      let callCount = 0;

      mockGenerateLegacy.mockImplementation(async (_message, options) => {
        callCount++;
        if (callCount === 1) {
          const repaired = await options.experimental_repairText({
            text: '{"refinedChecklists":["項目1","項目2"',
          });
          return { object: JSON.parse(repaired) };
        }
        // 2回目で同じ項目を返す
        return {
          object: {
            refinedChecklists: ["項目1", "項目3"], // 項目1は重複
          },
        };
      });

      // Act
      const result = await checklistRefinementStep.execute({
        inputData: {
          systemChecklists: testSystemChecklists,
          checklistRequirements: testChecklistRequirements,
        },
        runtimeContext: createTestRuntimeContext(),
        getStepResult: vi.fn(),
        getInitData: vi.fn(),
        suspend: vi.fn(),
        runId: "test-run-id",
        bail: vi.fn(),
      } as any);

      // Assert
      expect(result.status).toBe("success");
      // 項目1は1つだけ
      expect(
        result.refinedItems?.filter((item) => item === "項目1"),
      ).toHaveLength(1);
      expect(result.refinedItems).toContain("項目2");
      expect(result.refinedItems).toContain("項目3");
    });
  });
});
