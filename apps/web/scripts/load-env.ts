import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRootDir = path.resolve(scriptDir, "..");
const repoRootDir = path.resolve(webRootDir, "..", "..");

const loadedFlag = "__neutralpress_web_env_loaded__";

function getEnvFiles(nodeEnv: string): string[] {
  const files = [`.env.${nodeEnv}.local`];
  if (nodeEnv !== "test") {
    files.push(".env.local");
  }
  files.push(`.env.${nodeEnv}`, ".env");
  return files;
}

function loadEnvFromDirectory(dir: string, envFiles: string[]) {
  for (const envFile of envFiles) {
    const envPath = path.join(dir, envFile);
    if (!fs.existsSync(envPath)) {
      continue;
    }
    config({
      path: envPath,
      quiet: true,
    });
  }
}

function normalizeEnvValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function getRuntimeDatabaseUrl(): string | undefined {
  loadWebEnv();
  return normalizeEnvValue(process.env.DATABASE_URL);
}

export function getPrismaDatabaseUrl(): string | undefined {
  loadWebEnv();
  return normalizeEnvValue(process.env.DIRECT_URL) ?? getRuntimeDatabaseUrl();
}

export function loadWebEnv(): void {
  const globalState = globalThis as Record<string, unknown>;
  if (globalState[loadedFlag]) {
    return;
  }

  const nodeEnv = process.env.NODE_ENV ?? "development";
  const envFiles = getEnvFiles(nodeEnv);

  // 优先加载 apps/web 下的 env，再加载仓库根目录作为兜底。
  loadEnvFromDirectory(webRootDir, envFiles);
  loadEnvFromDirectory(repoRootDir, envFiles);

  const databaseUrl = normalizeEnvValue(process.env.DATABASE_URL);
  const directUrl = normalizeEnvValue(process.env.DIRECT_URL);

  if (!directUrl && databaseUrl) {
    process.env.DIRECT_URL = databaseUrl;
  }

  globalState[loadedFlag] = true;
}
