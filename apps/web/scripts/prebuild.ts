// script/prebuild.ts
// run before building the project

import fs from "fs";
import path from "path";
import Rlog from "rlog-js";

import { loadWebEnv } from "@/../scripts/load-env";
import { runTaskWithRetry } from "@/../scripts/retry-task";

// 加载 apps/web 与仓库根目录下的 .env* 文件
loadWebEnv();

const rlog = new Rlog();

rlog.config.setConfigGlobal({
  silent: true,
});

rlog.config.setConfig({
  customColorRules: [{ reg: "NeutralPress", color: "green" }],
  silent: false,
});

rlog.file.init();

const startTime = Date.now();
const isPortableBuild = process.env.BUILD_PROFILE === "portable";

function runPrebuildTask<T>(
  taskName: string,
  task: () => Promise<T> | T,
): Promise<T> {
  return runTaskWithRetry(taskName, task, {
    logger: rlog,
  });
}

rlog.log();
rlog.log("NeutralPress Initializing...");
rlog.log();

const nextCacheDir = path.join(process.cwd(), ".next", "cache");
if (fs.existsSync(nextCacheDir)) {
  rlog.info("Clearing Next.js cache...");
  fs.rmSync(nextCacheDir, { recursive: true, force: true });
  rlog.log();
}

const cacheDir = path.join(process.cwd(), ".cache");
if (fs.existsSync(cacheDir)) {
  rlog.info("Clearing build cache...");
  fs.rmSync(cacheDir, { recursive: true, force: true });
  rlog.log();
}

try {
  if (isPortableBuild) {
    rlog.warning(
      "Portable build profile detected: skip DB/Redis initialization during build.",
    );
    rlog.log();
  } else {
    rlog.log("Starting environment variables check...");
    const { checkEnvironmentVariables } = await import("./check-env.js");
    await runPrebuildTask(
      "environment variables check",
      checkEnvironmentVariables,
    );
    rlog.log();

    rlog.log("Starting JWT key pair validation and Redis connection check...");
    const [{ checkJWTKeyPair }, { checkRedisConnection }] = await Promise.all([
      import("./check-jwt-token.js"),
      import("./check-redis.js"),
    ]);
    await Promise.all([
      runPrebuildTask("JWT key pair validation", checkJWTKeyPair),
      runPrebuildTask("Redis connection check", checkRedisConnection),
    ]);
    rlog.log();

    const [
      { closePrismaScriptRuntime, createPrismaScriptRuntime },
      { checkDatabaseHealth },
      { updateDatabase },
      { seedDefaults },
      { syncPersistentMedia },
      { syncCloudInstance },
      { generateConfigCache },
      { generateMenuCache },
      { generatePageCache },
      { default: generateViewCountCache },
    ] = await Promise.all([
      import("./load-prisma-client.js"),
      import("./check-db.js"),
      import("./update-db.js"),
      import("./seed-defaults.js"),
      import("./sync-persistent-media.js"),
      import("./sync-cloud-instance.js"),
      import("./generate-config-cache.js"),
      import("./generate-menu-cache.js"),
      import("./generate-page-cache.js"),
      import("./generate-view-count-cache.js"),
    ]);

    rlog.log("Starting Prisma runtime initialization...");
    const prismaRuntime = await runPrebuildTask(
      "Prisma runtime initialization",
      createPrismaScriptRuntime,
    );
    rlog.log();
    const sharedPrisma = prismaRuntime.prisma;
    try {
      rlog.log("Starting database check...");
      await runPrebuildTask("database check", () =>
        checkDatabaseHealth({ prisma: sharedPrisma }),
      );
      rlog.log();

      rlog.log("Starting database update...");
      await runPrebuildTask("database update", () =>
        updateDatabase({ prisma: sharedPrisma }),
      );
      rlog.log();

      rlog.info("Starting database seeding with default values...");
      await runPrebuildTask("database seeding", () =>
        seedDefaults({ prisma: sharedPrisma }),
      );
      rlog.log();

      rlog.log("Starting persistent media synchronization...");
      await runPrebuildTask("persistent media synchronization", () =>
        syncPersistentMedia({ prisma: sharedPrisma }),
      );
      rlog.log();

      rlog.log("Starting cloud instance synchronization...");
      await runPrebuildTask("cloud instance synchronization", () =>
        syncCloudInstance({ prisma: sharedPrisma }),
      );
      rlog.log();

      rlog.log("Starting configuration, menu, and page cache generation...");
      await Promise.all([
        runPrebuildTask("configuration cache generation", () =>
          generateConfigCache({ prisma: sharedPrisma }),
        ),
        runPrebuildTask("menu cache generation", () =>
          generateMenuCache({ prisma: sharedPrisma }),
        ),
        runPrebuildTask("page cache generation", () =>
          generatePageCache({ prisma: sharedPrisma }),
        ),
      ]);
      rlog.log();

      rlog.log("Starting view count cache generation...");
      await runPrebuildTask("view count cache generation", () =>
        generateViewCountCache({ prisma: sharedPrisma }),
      );
      rlog.log();
    } finally {
      await closePrismaScriptRuntime(prismaRuntime);
    }
  }

  rlog.log("Starting block business catalog generation...");
  const { generateBlockBusinessCatalog } = await import(
    "./generate-block-business-catalog.js"
  );
  await runPrebuildTask("block business catalog generation", () => {
    generateBlockBusinessCatalog();
  });
  rlog.log();

  rlog.log("Starting block definition catalog generation...");
  const { generateBlockDefinitionCatalog } = await import(
    "./generate-block-definition-catalog.js"
  );
  await runPrebuildTask("block definition catalog generation", () => {
    generateBlockDefinitionCatalog();
  });

  // 完成 PreBuild
  const endTime = Date.now();

  // 写入构建元数据供 postbuild 使用
  const cacheDir = path.join(process.cwd(), ".cache");
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(cacheDir, "build-meta.json"),
    JSON.stringify({
      prebuildStartTime: startTime,
      prebuildEndTime: endTime,
    }),
  );

  rlog.success("✓ NeutralPress initialization completed successfully!");
  rlog.log("Time spend: " + ((endTime - startTime) / 1000).toFixed(2) + "s");
} catch (error) {
  rlog.log();
  rlog.error("Prebuild failed:");
  rlog.error(`  ${error instanceof Error ? error.message : String(error)}`);
  rlog.log();
  if (isPortableBuild) {
    rlog.error(
      "Please check your build configuration and generated code artifacts.",
    );
  } else {
    rlog.error(
      "Please check your database, Redis, or external service configuration and try again.",
    );
  }
  process.exit(1);
}
