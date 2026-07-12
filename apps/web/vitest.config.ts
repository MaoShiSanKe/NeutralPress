import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: true,
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./src/test/shims/server-only.ts"),
    },
    exclude: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/.cache/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary"],
      reportOnFailure: true,
      include: [
        "src/lib/server/**/*.ts",
        "src/hooks/**/*.ts",
        "src/actions/**/*.ts",
      ],
      exclude: [
        "src/**/*.d.ts",
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
        "src/**/__tests__/**",
        "src/**/types.ts",
        "src/**/*types*.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./src/test/shims/server-only.ts"),
    },
  },
});
