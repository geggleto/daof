import type { CapabilityInstance, CapabilityInput, CapabilityOutput } from "../../types/json.js";
import type { CapabilityDefinition } from "../../schema/index.js";

function hasStringEndpoint(
  config: CapabilityDefinition["config"]
): config is Record<string, import("../../types/json.js").JsonValue> & { endpoint: string } {
  return (
    config !== undefined &&
    typeof config === "object" &&
    config !== null &&
    "endpoint" in config &&
    typeof (config as Record<string, import("../../types/json.js").JsonValue>).endpoint === "string"
  );
}

/**
 * Build a CapabilityInstance for an inline tool (no source). If config has endpoint, use HTTP POST;
 * otherwise return a stub that echoes input.
 */
export function createInlineToolInstance(
  capabilityId: string,
  def: CapabilityDefinition
): CapabilityInstance {
  const config = def.config;
  if (hasStringEndpoint(config)) {
    const endpoint = config.endpoint;
    const apiKey =
      "api_key" in config && typeof config.api_key === "string" ? config.api_key : undefined;
    return {
      async execute(
        input: CapabilityInput,
        _runContext?: import("../../runtime/run-context.js").RunContext
      ): Promise<CapabilityOutput> {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
        const res = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(input),
        });
        const text = await res.text();
        if (!res.ok) {
          return { error: text, status: res.status };
        }
        try {
          const data = JSON.parse(text) as CapabilityOutput;
          return data;
        } catch {
          return { body: text };
        }
      },
    };
  }
  return {
    async execute(
      input: CapabilityInput,
      _runContext?: import("../../runtime/run-context.js").RunContext
    ): Promise<CapabilityOutput> {
      return { ok: true, capabilityId, input };
    },
  };
}
