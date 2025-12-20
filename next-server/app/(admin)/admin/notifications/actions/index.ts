"use server";

import { z } from "zod";
import { adminAction } from "@/lib/server/baseAction";
import { SystemNotificationRepository } from "@/infrastructure/adapter/db";
import {
  ListSystemNotificationsService,
  CreateSystemNotificationService,
  UpdateSystemNotificationService,
  DeleteSystemNotificationService,
} from "@/application/system-notification";

/**
 * システム通知一覧取得アクション
 */
const listNotificationsSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  activeOnly: z.boolean().optional(),
});

export const listNotificationsAction = adminAction
  .schema(listNotificationsSchema)
  .action(async ({ parsedInput }) => {
    const repository = new SystemNotificationRepository();
    const service = new ListSystemNotificationsService(repository);
    return service.execute(parsedInput);
  });

/**
 * システム通知作成アクション
 */
const createNotificationSchema = z.object({
  message: z.string().min(1).max(1000),
  displayOrder: z.number().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const createNotificationAction = adminAction
  .schema(createNotificationSchema)
  .action(async ({ parsedInput }) => {
    const repository = new SystemNotificationRepository();
    const service = new CreateSystemNotificationService(repository);
    return service.execute(parsedInput);
  });

/**
 * システム通知更新アクション
 */
const updateNotificationSchema = z.object({
  id: z.string().uuid(),
  message: z.string().min(1).max(1000).optional(),
  displayOrder: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const updateNotificationAction = adminAction
  .schema(updateNotificationSchema)
  .action(async ({ parsedInput }) => {
    const repository = new SystemNotificationRepository();
    const service = new UpdateSystemNotificationService(repository);
    return service.execute(parsedInput);
  });

/**
 * システム通知削除アクション
 */
const deleteNotificationSchema = z.object({
  id: z.string().uuid(),
});

export const deleteNotificationAction = adminAction
  .schema(deleteNotificationSchema)
  .action(async ({ parsedInput }) => {
    const repository = new SystemNotificationRepository();
    const service = new DeleteSystemNotificationService(repository);
    await service.execute(parsedInput);
    return { success: true };
  });
