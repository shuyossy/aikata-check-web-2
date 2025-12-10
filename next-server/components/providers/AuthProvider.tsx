"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * NextAuth SessionProviderのラッパーコンポーネント
 * クライアントコンポーネントとして認証状態を子コンポーネントに提供
 */
export function AuthProvider({ children }: AuthProviderProps) {
  return <SessionProvider>{children}</SessionProvider>;
}
