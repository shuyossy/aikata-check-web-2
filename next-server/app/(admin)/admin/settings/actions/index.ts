"use server";

import { z } from "zod";
import { adminAction } from "@/lib/server/baseAction";
import { SystemSettingRepository } from "@/infrastructure/adapter/db";
import {
  GetSystemSettingService,
  UpdateSystemSettingService,
} from "@/application/system-setting";

/**
 * システム設定取得アクション
 */
export const getSystemSettingAction = adminAction.action(async () => {
  const repository = new SystemSettingRepository();
  const service = new GetSystemSettingService(repository);
  return service.execute();
});

/**
 * システム設定更新アクション
 */
const updateSystemSettingSchema = z.object({
  apiKey: z.string().optional(),
  apiUrl: z.string().url().optional().or(z.literal("")),
  apiModel: z.string().optional(),
});

export const updateSystemSettingAction = adminAction
  .schema(updateSystemSettingSchema)
  .action(async ({ parsedInput }) => {
    const repository = new SystemSettingRepository();
    const service = new UpdateSystemSettingService(repository);
    return service.execute({
      apiKey: parsedInput.apiKey || null,
      apiUrl: parsedInput.apiUrl || null,
      apiModel: parsedInput.apiModel || null,
    });
  });
