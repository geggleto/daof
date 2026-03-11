import type { CapabilityInstance, CapabilityInput, CapabilityOutput } from "../../types/json.js";
import type { CapabilityDefinition } from "../../schema/index.js";
import type { RunContext } from "../../runtime/run-context.js";
import { getAuthHeadersFromCapabilityConfig } from "../auth/registry.js";
import { getProviderService } from "../../providers/registry.js";

function getEndpoint(def: CapabilityDefinition): string | undefined {
  const c = def.config;
  if (c && typeof c === "object" && "endpoint" in c && typeof (c as Record<string, unknown>).endpoint === "string") {
    return (c as Record<string, string>).endpoint;
  }
  return undefined;
}

/**
 * Bundled TextGenerator capability. Input: { prompt, max_tokens? }. Output: { text: string } or { ok: false, error }.
 * When config.endpoint is set: POST to that endpoint; parses response.text or response.choices[0].text. Auth: config.auth.strategy or legacy config.api_key.
 * When config.endpoint is not set: uses runContext.agentLlm (provider + apiKey) to get a provider service via getProviderService and calls service.complete(prompt, { max_tokens }). Provider execution (e.g. Cursor CLI) is behind the provider service layer.
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
      const providerId = agentLlm?.provider;
      const apiKey = agentLlm?.apiKey;
      const service = getProviderService(providerId ?? "", apiKey);
      if (!service) {
        return { ok: false, error: "Missing config.endpoint and no runContext.agentLlm (provider with API key) available." };
      }
      return service.complete(prompt, { max_tokens: maxTokens });
    },
  };
}
