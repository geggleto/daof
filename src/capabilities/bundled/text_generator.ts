import { spawn } from "child_process";
import type { CapabilityInstance, CapabilityInput, CapabilityOutput } from "../../types/json.js";
import type { CapabilityDefinition } from "../../schema/index.js";
import type { RunContext } from "../../runtime/run-context.js";
import { getAuthHeadersFromCapabilityConfig } from "../auth/registry.js";

/** CLI command for Cursor headless (see https://cursor.com/docs/cli/headless). Override with CURSOR_CLI_CMD (e.g. "cursor" or full path). */
const DEFAULT_CURSOR_CLI_CMD = "agent";

function getEndpoint(def: CapabilityDefinition): string | undefined {
  const c = def.config;
  if (c && typeof c === "object" && "endpoint" in c && typeof (c as Record<string, unknown>).endpoint === "string") {
    return (c as Record<string, string>).endpoint;
  }
  return undefined;
}

function runCursorCli(prompt: string, apiKey: string): Promise<CapabilityOutput> {
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
}

/**
 * Bundled TextGenerator capability. Input: { prompt, max_tokens? }. Output: { text: string } or { ok: false, error }.
 * When config.endpoint is set: POST to that endpoint; parses response.text or response.choices[0].text. Auth: config.auth.strategy or legacy config.api_key.
 * When config.endpoint is not set and runContext.agentLlm.provider === "cursor" (with apiKey): runs Cursor headless CLI (agent -p "<prompt>") and returns stdout as text. See https://cursor.com/docs/cli/headless.
 */
export function createTextGeneratorInstance(
  _capabilityId: string,
  def: CapabilityDefinition
): CapabilityInstance {
  const endpoint = getEndpoint(def);

  return {
    async execute(
      input: CapabilityInput,
      runContext?: RunContext
    ): Promise<CapabilityOutput> {
      const prompt = typeof input.prompt === "string" ? input.prompt : "";
      const maxTokens = typeof input.max_tokens === "number" ? input.max_tokens : undefined;

      if (endpoint) {
        const body: Record<string, unknown> = { prompt };
        if (maxTokens != null) body.max_tokens = maxTokens;
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          ...getAuthHeadersFromCapabilityConfig(def.config),
        };
        try {
          const res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
          const data = (await res.json()) as Record<string, unknown>;
          if (!res.ok) {
            const msg = typeof data?.error === "string" ? data.error : res.statusText;
            return { ok: false, error: msg };
          }
          let text = "";
          if (typeof data.text === "string") {
            text = data.text;
          } else if (Array.isArray(data.choices) && data.choices[0]) {
            const c = data.choices[0] as Record<string, unknown>;
            if (typeof c.text === "string") text = c.text;
            else if (c.message && typeof (c.message as Record<string, unknown>).content === "string") {
              text = (c.message as Record<string, string>).content;
            }
          }
          return { text };
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err);
          return { ok: false, error };
        }
      }

      const agentLlm = runContext?.agentLlm;
      if (agentLlm?.provider === "cursor") {
        if (!agentLlm.apiKey) {
          return { ok: false, error: "Cursor provider requires CURSOR_API_KEY to be set in the environment." };
        }
        return runCursorCli(prompt, agentLlm.apiKey);
      }

      return { ok: false, error: "Missing config.endpoint and no runContext.agentLlm (Cursor with API key) available." };
    },
  };
}
