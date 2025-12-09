import type { Config } from "drizzle-kit";
import "dotenv/config";

export default {
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ||
      "postgresql://user:pass@localhost:5433/postgres",
  },
} satisfies Config;
