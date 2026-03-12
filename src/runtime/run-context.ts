import type { BackboneAdapter } from "../backbone/types.js";
import type { CapabilityInput, CapabilityOutput } from "../types/json.js";
import type { OrgConfig } from "../schema/index.js";
import type { CapabilityInstance } from "../types/json.js";
import {
  type CapabilityStore,
  createScopedCapabilityStore,
} from "../backbone/capability-store.js";
import { executeCapabilityWithMiddleware } from "./middleware.js";

/**
 * Agent LLM config passed into capabilities so they can call the LLM (provider, model, API key).
 */
export interface AgentLlm {
  provider: string;
  model: string;
  apiKey?: string;
}

/**
 * Facade passed into step execution so agents/capabilities can publish in realtime,
 * invoke other capabilities (when depends_on is declared), and use the capability store (KV).
 */
export interface RunContext {
  backbone?: BackboneAdapter;
  /**
   * When present, the capability may call another capability by id. Allowed targets
   * are those listed in this capability's depends_on in the manifest.
   */
  invokeCapability?(
    capabilityId: string,
    input?: CapabilityInput
  ): Promise<CapabilityOutput>;
  /** When present (e.g. Redis backbone), capabilities can get/set/delete by key. */
  capabilityStore?: CapabilityStore;
  /** When present, shared store for agent metrics (middleware and fetch_agent_performance). */
  metricsStore?: CapabilityStore;
  /** When present, the current agent's provider/model/API key for LLM calls. Passed from executor; nested invocations inherit it. */
  agentLlm?: AgentLlm;
}

/**
 * Minimal runtime deps needed to build a RunContext (avoids circular import with bootstrap).
 */
export interface RunContextFactoryDeps {
  config: OrgConfig;
  capabilities: Map<string, CapabilityInstance>;
  backbone?: BackboneAdapter;
  capabilityStore?: CapabilityStore;
  metricsStore?: CapabilityStore;
  capabilityMiddleware?: import("./middleware.js").CapabilityMiddleware[];
}

/**
 * Build a RunContext for the given capability. InvokeCapability is scoped to that
 * capability's depends_on; nested invocations get their own RunContext and inherit agentLlm when provided.
 */
export function createRunContext(
  deps: RunContextFactoryDeps,
  currentCapabilityId: string,
  agentLlm?: AgentLlm
): RunContext {
  const def = deps.config.capabilities[currentCapabilityId];
  const allowed = def?.depends_on ?? [];

  const invokeCapability = async (
    capabilityId: string,
    input?: CapabilityInput
  ): Promise<CapabilityOutput> => {
    if (!allowed.includes(capabilityId)) {
      throw new Error(
        `Capability "${currentCapabilityId}" may not invoke "${capabilityId}" (not in depends_on).`
      );
    }
    const target = deps.capabilities.get(capabilityId);
    if (!target) {
      throw new Error(`Capability not found: ${capabilityId}`);
    }
    const nestedRunContext = createRunContext(deps, capabilityId, agentLlm);
    const hasCapabilityMiddleware = deps.capabilityMiddleware && deps.capabilityMiddleware.length > 0;
    if (hasCapabilityMiddleware && deps.capabilityMiddleware) {
      return executeCapabilityWithMiddleware(
        deps as import("./middleware.js").RuntimeWithMiddleware,
        capabilityId,
        target,
        input ?? {},
        nestedRunContext
      );
    }
    return target.execute(input ?? {}, nestedRunContext);
  };

  const hasPersistence = def?.persistence != null && String(def.persistence).trim() !== "";
  const capabilityStore =
    hasPersistence && deps.capabilityStore
      ? createScopedCapabilityStore(currentCapabilityId, deps.capabilityStore)
      : undefined;

  return {
    ...(deps.backbone && { backbone: deps.backbone }),
    invokeCapability,
    ...(capabilityStore && { capabilityStore }),
    ...(deps.metricsStore && { metricsStore: deps.metricsStore }),
    ...(agentLlm && { agentLlm }),
  };
}
