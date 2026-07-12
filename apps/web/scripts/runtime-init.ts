// scripts/runtime-init.ts
// 运行期初始化：连接外部依赖并执行迁移、种子和缓存预热

import Rlog from "rlog-js";
import { pathToFileURL } from "url";

import { loadWebEnv } from "@/../scripts/load-env";
import {
  closePrismaScriptRuntime,
  createPrismaScriptRuntime,
} from "@/../scripts/load-prisma-client";
import { runTaskWithRetry } from "@/../scripts/retry-task";

loadWebEnv();

const rlog = new Rlog();

rlog.config.setConfig({
  customColorRules: [{ reg: "NeutralPress", color: "green" }],
  silent: false,
});

export async function runRuntimeInitialization(): Promise<void> {
  await runRuntimeInitializationWithOptions();
}

export async function runRuntimeInitializationWithOptions(options?: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma?: any;
  runMigrateDeploy?: () => Promise<void>;
}): Promise<void> {
  rlog.log();
  rlog.log("NeutralPress Runtime Initialization...");
  rlog.log();

  rlog.log("Starting environment variables check...");
  const { checkEnvironmentVariables } = await import("./check-env.js");
  await runTaskWithRetry(
    "environment variables check",
    checkEnvironmentVariables,
    {
      logger: rlog,
    },
  );
  rlog.log();

  rlog.log("Starting JWT key pair validation and Redis connection check...");
  const [{ checkJWTKeyPair }, { checkRedisConnection }] = await Promise.all([
    import("./check-jwt-token.js"),
    import("./check-redis.js"),
  ]);
  await Promise.all([
    runTaskWithRetry("JWT key pair validation", checkJWTKeyPair, {
      logger: rlog,
    }),
    runTaskWithRetry("Redis connection check", checkRedisConnection, {
      logger: rlog,
    }),
  ]);
  rlog.log();

  rlog.log("Starting Prisma runtime initialization...");
  const runtime = options?.prisma
    ? null
    : await runTaskWithRetry(
        "Prisma runtime initialization",
        createPrismaScriptRuntime,
        {
          logger: rlog,
        },
      );
  rlog.log();
  const sharedPrisma = options?.prisma ?? runtime?.prisma;

  try {
    rlog.log("Starting database check...");
    const { checkDatabaseHealth } = await import("./check-db.js");
    await runTaskWithRetry(
      "database check",
      () =>
        checkDatabaseHealth({
          prisma: sharedPrisma,
        }),
      {
        logger: rlog,
      },
    );
    rlog.log();

    rlog.log("Starting database update...");
    const { updateDatabase } = await import("./update-db.js");
    await runTaskWithRetry(
      "database update",
      () =>
        updateDatabase({
          prisma: sharedPrisma,
          runMigrateDeploy: options?.runMigrateDeploy,
        }),
      {
        logger: rlog,
      },
    );
    rlog.log();

    rlog.info("Starting database seeding with default values...");
    const { seedDefaults } = await import("./seed-defaults.js");
    await runTaskWithRetry(
      "database seeding",
      () =>
        seedDefaults({
          prisma: sharedPrisma,
        }),
      {
        logger: rlog,
      },
    );
    rlog.log();

    rlog.log("Starting persistent media synchronization...");
    const { syncPersistentMedia } = await import("./sync-persistent-media.js");
    await runTaskWithRetry(
      "persistent media synchronization",
      () =>
        syncPersistentMedia({
          prisma: sharedPrisma,
        }),
      {
        logger: rlog,
      },
    );
    rlog.log();

    rlog.log("Starting cloud instance synchronization...");
    const { syncCloudInstance } = await import("./sync-cloud-instance.js");
    await runTaskWithRetry(
      "cloud instance synchronization",
      () =>
        syncCloudInstance({
          prisma: sharedPrisma,
        }),
      {
        logger: rlog,
      },
    );
    rlog.log();

    rlog.log("Starting view count cache generation...");
    const { default: generateViewCountCache } = await import(
      "./generate-view-count-cache.js"
    );
    await runTaskWithRetry(
      "view count cache generation",
      () =>
        generateViewCountCache({
          prisma: sharedPrisma,
        }),
      {
        logger: rlog,
      },
    );
    rlog.log();
  } finally {
    await closePrismaScriptRuntime(runtime);
  }

  rlog.success("✓ Runtime initialization completed successfully!");
  rlog.log();
}

async function main() {
  try {
    await runRuntimeInitializationWithOptions();
  } catch (error) {
    rlog.log();
    rlog.error(
      `Runtime initialization failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

function isMainModule(): boolean {
  try {
    const arg1 = process.argv[1];
    return (
      import.meta.url === pathToFileURL(arg1 || "").href ||
      (arg1?.endsWith("runtime-init.ts") ?? false) ||
      (arg1?.endsWith("runtime-init.js") ?? false)
    );
  } catch {
    return false;
  }
}

if (isMainModule()) {
  main();
}
