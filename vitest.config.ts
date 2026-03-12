import { defineConfig } from "vitest/config";
import tsconfig from "./tsconfig.json" with { type: "json" };

export default defineConfig({
  test: {
    include: ["tests/**/*.unit.test.ts", "tests/**/*.integration.test.ts"],
    setupFiles: ["./tests/setup.ts"],
  },
  resolve: {
    extensions: [".ts"],
  },
  esbuild: {
    target: (tsconfig.compilerOptions?.target as string) ?? "es2022",
  },
});
