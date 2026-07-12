import { createRequire } from "module";

import { getPrismaDatabaseUrl } from "@/../scripts/load-env";
import { runPrismaGenerate } from "@/../scripts/prisma-cli";

type PrismaClientInstance = {
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
};

type PrismaClientConstructor = new (options?: unknown) => PrismaClientInstance;

type PgPoolInstance = {
  end(): Promise<void>;
};

type PrismaScriptRuntime = {
  prisma: PrismaClientInstance;
  pool: PgPoolInstance;
};

type PrismaClientModuleNamespace = {
  PrismaClient?: PrismaClientConstructor;
  default?: {
    PrismaClient?: PrismaClientConstructor;
  };
};

const requireModule = createRequire(import.meta.url);

function isPrismaClientNotGeneratedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("@prisma/client did not initialize yet");
}

async function createRuntimeFromConstructor(
  PrismaClient: PrismaClientConstructor,
): Promise<PrismaScriptRuntime> {
  const [{ Pool }, { PrismaPg }] = await Promise.all([
    import("pg"),
    import("@prisma/adapter-pg"),
  ]);

  const pool = new Pool({
    connectionString: getPrismaDatabaseUrl(),
  });
  let prisma: PrismaClientInstance | null = null;

  try {
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({
      adapter,
      log: [],
    });

    await prisma.$connect();

    return {
      prisma,
      pool,
    };
  } catch (error) {
    await prisma?.$disconnect().catch(() => undefined);
    await pool.end().catch(() => undefined);
    throw error;
  }
}

function extractPrismaClient(
  namespace: PrismaClientModuleNamespace,
): PrismaClientConstructor | null {
  return namespace.PrismaClient ?? namespace.default?.PrismaClient ?? null;
}

export async function loadPrismaClientConstructor(): Promise<PrismaClientConstructor> {
  const errors: string[] = [];

  try {
    const namespace = requireModule(
      ".prisma/client",
    ) as PrismaClientModuleNamespace;
    const PrismaClient = extractPrismaClient(namespace);
    if (PrismaClient) {
      return PrismaClient;
    }
    errors.push('".prisma/client" 已加载但未导出 PrismaClient');
  } catch (error) {
    errors.push(
      `".prisma/client" 加载失败：${error instanceof Error ? error.message : String(error)}`,
    );
  }

  try {
    const namespace = requireModule(
      "@prisma/client",
    ) as PrismaClientModuleNamespace;
    const PrismaClient = extractPrismaClient(namespace);
    if (PrismaClient) {
      return PrismaClient;
    }
    errors.push('"@prisma/client" 已加载但未导出 PrismaClient');
  } catch (error) {
    errors.push(
      `"@prisma/client" 加载失败：${error instanceof Error ? error.message : String(error)}`,
    );
  }

  throw new Error(
    [
      "无法加载 PrismaClient 构造函数。",
      "已尝试以下模块：",
      ...errors.map((message) => `- ${message}`),
    ].join("\n"),
  );
}

export async function createPrismaScriptRuntime(): Promise<PrismaScriptRuntime> {
  let PrismaClient: PrismaClientConstructor;

  try {
    PrismaClient = await loadPrismaClientConstructor();
  } catch (loadError) {
    runPrismaGenerate({
      cwd: process.cwd(),
    });

    try {
      PrismaClient = await loadPrismaClientConstructor();
    } catch (regeneratedLoadError) {
      throw new Error(
        [
          "Prisma client is unavailable after running prisma generate.",
          `Initial load error: ${loadError instanceof Error ? loadError.message : String(loadError)}`,
          `Reload error: ${regeneratedLoadError instanceof Error ? regeneratedLoadError.message : String(regeneratedLoadError)}`,
        ].join("\n"),
      );
    }
  }

  try {
    return await createRuntimeFromConstructor(PrismaClient);
  } catch (runtimeError) {
    if (!isPrismaClientNotGeneratedError(runtimeError)) {
      throw runtimeError;
    }

    runPrismaGenerate({
      cwd: process.cwd(),
    });
    PrismaClient = await loadPrismaClientConstructor();
    return createRuntimeFromConstructor(PrismaClient);
  }
}

export async function closePrismaScriptRuntime(
  runtime: PrismaScriptRuntime | null | undefined,
): Promise<void> {
  if (!runtime) {
    return;
  }

  await runtime.prisma.$disconnect();
  await runtime.pool.end();
}
