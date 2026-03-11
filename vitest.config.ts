import { defineConfig } from "vitest/config";
import tsconfig from "./tsconfig.json" with { type: "json" };

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    extensions: [".ts"],
  },
  esbuild: {
    target: (tsconfig.compilerOptions?.target as string) ?? "es2022",
  },
});
