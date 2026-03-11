import { spawn } from "child_process";
import type { LLMProviderService } from "./llm-provider-service.js";

/** CLI command for Cursor headless (see https://cursor.com/docs/cli/headless). Override with CURSOR_CLI_CMD (e.g. "cursor" or full path). */
const DEFAULT_CURSOR_CLI_CMD = "agent";

/**
 * Cursor provider execution: runs the Cursor headless CLI with the given API key.
 * Owns all Cursor-specific logic (binary name, spawn, env).
 */
export function createCursorProviderService(apiKey: string): LLMProviderService {
  return {
    async complete(prompt: string): Promise<{ text: string } | { ok: false; error: string }> {
      return new Promise((resolve) => {
        const cmd = process.env.CURSOR_CLI_CMD ?? DEFAULT_CURSOR_CLI_CMD;
        const args = ["-p", prompt, "--output-format", "text", "--trust"];
        const env = { ...process.env, CURSOR_API_KEY: apiKey };
        const child = spawn(cmd, args, {
          env,
          stdio: ["ignore", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";
        child.stdout?.on("data", (chunk: Buffer) => {
          stdout += chunk.toString();
        });
        child.stderr?.on("data", (chunk: Buffer) => {
          stderr += chunk.toString();
        });
        child.on("error", (err) => {
          resolve({ ok: false, error: err.message });
        });
        child.on("close", (code) => {
          const text = stdout.trim();
          if (code !== 0) {
            const errMsg = stderr.trim() || `Cursor CLI exited with code ${code}`;
            resolve({ ok: false, error: errMsg });
            return;
          }
          resolve({ text: text || "" });
        });
      });
    },
  };
}
