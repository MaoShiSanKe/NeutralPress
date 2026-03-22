import { defineConfig } from "prisma/config";

// Prisma CLI 直接加载这个文件时不会解析项目里的路径别名。
// eslint-disable-next-line no-relative-import-paths/no-relative-import-paths
import { getPrismaDatabaseUrl } from "./scripts/load-env";

const prismaCliUrl = getPrismaDatabaseUrl() ?? "";

export default defineConfig({
  engine: "classic",
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: prismaCliUrl,
  },
});
