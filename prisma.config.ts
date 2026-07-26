import { config as loadEnvironment } from "dotenv";
import { defineConfig } from "prisma/config";

loadEnvironment({ path: ".env.local", quiet: true });
loadEnvironment({ path: ".env", quiet: true });

const developmentDatabaseUrl =
  "postgresql://frl:frl@localhost:5432/frl_race_control?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url:
      process.env.DIRECT_URL ??
      process.env.DATABASE_URL ??
      developmentDatabaseUrl,
  },
});
