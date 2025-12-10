import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/drizzle/schema";

// PostgreSQL接続プール
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Drizzle ORMインスタンス
export const db = drizzle(pool, { schema });

// DB型エクスポート
export type Database = typeof db;
