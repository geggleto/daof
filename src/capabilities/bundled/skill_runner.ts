import type { CapabilityInstance, CapabilityInput, CapabilityOutput, JsonValue } from "../../types/json.js";
import type { CapabilityDefinition } from "../../schema/index.js";
import { getAuthHeadersFromCapabilityConfig } from "../auth/registry.js";
import { getProviderService } from "../../providers/registry.js";

const TEMPLATE_REGEX = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)\s*\}\}/g;

function getAtPath(obj: Record<string, JsonValue>, path: string): JsonValue | undefined {
  const parts = path.split(".");
  let current: JsonValue = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, JsonValue>)[part];
  }
  return current;
}

function resolvePromptTemplate(template: string, input: CapabilityInput): string {
  const inputObj = input as Record<string, JsonValue>;
  return template.replace(TEMPLATE_REGEX, (_, path: string) => {
    const value = getAtPath(inputObj, path);
    if (value === undefined || value === null) return "";
    return String(value);
  });
}

function getEndpoint(def: CapabilityDefinition): string | undefined {
  const c = def.config;
  if (c && typeof c === "object" && "endpoint" in c && typeof (c as Record<string, unknown>).endpoint === "string") {
    return (c as Record<string, string>).endpoint;
  }
  return undefined;
}

/**
 * Skill capability: uses def.prompt as a template ({{ key }} or {{ key.nested }} from input),
 * optionally calls an LLM at config.endpoint (same pattern as text_generator), and can invoke
 * other capabilities via runContext.invokeCapability when depends_on is set.
 */
export function createSkillRunnerInstance(
  _capabilityId: string,
  def: CapabilityDefinition
): CapabilityInstance {
  const endpoint = getEndpoint(def);
  const promptTemplate = typeof def.prompt === "string" ? def.prompt : "";

  return {
    async execute(
      input: CapabilityInput,
      runContext?: import("../../runtime/run-context.js").RunContext
    ): Promise<CapabilityOutput> {
      const renderedPrompt = resolvePromptTemplate(promptTemplate, input);

      if (endpoint) {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          ...getAuthHeadersFromCapabilityConfig(def.config),
        };
        try {
          const res = await fetch(endpoint, {
            method: "POST",
            headers,
            body: JSON.stringify({ prompt: renderedPrompt }),
          });
          const data = (await res.json()) as Record<string, unknown>;
          if (!res.ok) {
            const msg = typeof data?.error === "string" ? data.error : res.statusText;
            return { ok: false, error: msg };
          }
          let text = "";
          if (typeof data.text === "string") {
            text = data.text;
          } else if (Array.isArray(data.choices) && data.choices[0] && typeof (data.choices[0] as Record<string, unknown>).text === "string") {
            text = (data.choices[0] as Record<string, string>).text;
          }
          return { text };
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err);
          return { ok: false, error };
        }
      }

      const agentLlm = runContext?.agentLlm;
      const providerId = agentLlm?.provider;
      const apiKey = agentLlm?.apiKey;
      const service = getProviderService(providerId ?? "", apiKey);
      if (!service) {
        return { ok: false, error: "Skill has no config.endpoint and no runContext.agentLlm (provider with API key) available." };
      }
      return service.complete(renderedPrompt, {
        model: agentLlm?.model ?? "auto",
      });
    },
  };
}
