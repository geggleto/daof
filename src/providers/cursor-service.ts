import { spawn } from "child_process";
import type { LLMProviderService } from "./llm-provider-service.js";

/** CLI command for Cursor headless (see https://cursor.com/docs/cli/headless). Override with CURSOR_CLI_CMD (e.g. "cursor" or full path). */
const DEFAULT_CURSOR_CLI_CMD = "agent";

function pick(env: NodeJS.ProcessEnv, keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = env[k];
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

/**
 * Cursor provider execution: runs the Cursor headless CLI with the given API key.
 * Owns all Cursor-specific logic (binary name, spawn, env).
 */
export function createCursorProviderService(apiKey: string): LLMProviderService {
  return {
    async complete(
      prompt: string,
      options?: { max_tokens?: number; model?: string }
    ): Promise<{ text: string } | { ok: false; error: string }> {
      const key = typeof apiKey === "string" ? apiKey.trim() : "";
      if (!key) {
        return {
          ok: false,
          error:
            "Cursor provider has no API key. Set CURSOR_API_KEY in .env or .env.local (in the directory where you run daof) or export it.",
        };
      }
      return new Promise((resolve) => {
        const cmd = process.env.CURSOR_CLI_CMD ?? DEFAULT_CURSOR_CLI_CMD;
        const model = options?.model ?? "auto";
        // Pass API key via --api-key and env so the child always receives it.
        const args = ["--api-key", key, "--model", model, "-p", prompt, "--output-format", "text", "--trust"];
        // Use a minimal env to avoid triggering system keychain (e.g. macOS); include only essentials + CURSOR_API_KEY.
        const minimalEnv: Record<string, string> = {
          ...pick(process.env, [
            "PATH", "HOME", "USER", "SHELL", "LANG", "LC_ALL", "TMPDIR", "TERM", "COLORTERM",
            "USERPROFILE", "TEMP", "TMP", "SystemRoot",
          ]),
          CURSOR_API_KEY: key,
        };
        const child = spawn(cmd, args, {
          env: minimalEnv,
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
            let errMsg = stderr.trim() || `Cursor CLI exited with code ${code}`;
            if (/Password not found|cursor-access-token|cursor-user/i.test(errMsg)) {
              errMsg += " Set CURSOR_API_KEY in .env or .env.local (or export it) so the Cursor CLI can authenticate without the keychain.";
            }
            resolve({ ok: false, error: errMsg });
            return;
          }
          resolve({ text: text || "" });
        });
      });
    },
  };
}
