"use server";

import { z } from "zod";
import { publicAction } from "@/lib/server/baseAction";
import { RegisterUserService } from "@/application/user";
import { UserRepository } from "@/infrastructure/adapter/db";
import { PasswordService } from "@/infrastructure/adapter/service";
import { MessageCode } from "@/types";

/**
 * サインアップ入力スキーマ
 */
const signupSchema = z.object({
  employeeId: z.string().min(1),
  displayName: z.string().min(1),
  password: z.string().min(1),
});

/**
 * サインアップアクション
 * 独自認証用のユーザ登録を行う
 */
export const signupAction = publicAction
  .schema(signupSchema)
  .action(async ({ parsedInput }): Promise<{ success: boolean; messageCode: MessageCode }> => {
    const { employeeId, displayName, password } = parsedInput;

    const registerUserService = new RegisterUserService(
      new UserRepository(),
      new PasswordService(),
    );

    await registerUserService.execute({
      employeeId,
      displayName,
      password,
    });

    return {
      success: true,
      messageCode: "SIGNUP_SUCCESS",
    };
  });
