import type { BackboneAdapter } from "../backbone/types.js";
import type { RegistryStore } from "../registry/registry-store.js";
import type { TicketStore } from "../tickets/index.js";
import type { TicketUpdate } from "../tickets/types.js";
import type { CapabilityInput, CapabilityOutput } from "../types/json.js";
import type { OrgConfig } from "../schema/index.js";
import type { CapabilityInstance } from "../types/json.js";
import { type CapabilityStore } from "../backbone/capability-store.js";
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
    invokeCapability?(capabilityId: string, input?: CapabilityInput): Promise<CapabilityOutput>;
    /** When present (e.g. Redis backbone), capabilities can get/set/delete by key. */
    capabilityStore?: CapabilityStore;
    /** When present, shared store for agent metrics (middleware and fetch_agent_performance). */
    metricsStore?: CapabilityStore;
    /** When present, the current agent's provider/model/API key for LLM calls. Passed from executor; nested invocations inherit it. */
    agentLlm?: AgentLlm;
    /** When present, skills/capabilities registry for metadata search (query_capability_registry, etc.). */
    registry?: RegistryStore;
    /** When present (daemon mode), capabilities should call this to replace the in-memory org config instead of writing to disk. */
    updateOrgConfig?: (config: OrgConfig) => void;
    /** When present (daemon mode), capabilities use this as the current config for merge/patch so the base is in-memory state. */
    getCurrentOrgConfig?: () => OrgConfig;
    /** When present (workflow run), capabilities can append updates to the run ticket for observability. */
    ticket?: {
        id: string;
        append(update: Omit<TicketUpdate, "at">): Promise<void>;
    };
    /** When present (workflow step), unique ID for this step execution (one per sequential step, including each parallel branch). */
    stepId?: string;
    /** When present (workflow run), the workflow run ID. Available even when ticket store is not set. */
    runId?: string;
    /** When present (workflow step), the id of the agent executing the current step (e.g. security_auditor). */
    agentId?: string;
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
    registry?: RegistryStore;
    ticketStore?: TicketStore;
    capabilityMiddleware?: import("./middleware.js").CapabilityMiddleware[];
    /** When set (daemon mode), createRunContext will set updateOrgConfig and getCurrentOrgConfig on the returned context. */
    orgFilePath?: string;
}
export interface RunInfo {
    workflowId: string;
    runId: string;
}
/**
 * Build a RunContext for the given capability. InvokeCapability is scoped to that
 * capability's depends_on; nested invocations get their own RunContext and inherit agentLlm when provided.
 * When runInfo and ticketStore are present, context.ticket allows appending updates to the run ticket.
 * When stepId/runId/agentId are provided (workflow executor), capabilities can use them for step/run/agent-scoped identifiers.
 */
export declare function createRunContext(deps: RunContextFactoryDeps, currentCapabilityId: string, agentLlm?: AgentLlm, runInfo?: RunInfo, stepId?: string, runId?: string, agentId?: string): RunContext;
//# sourceMappingURL=run-context.d.ts.map