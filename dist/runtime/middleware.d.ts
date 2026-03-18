import type { CapabilityInput, CapabilityOutput } from "../types/json.js";
import type { CapabilityInstance } from "../types/json.js";
import type { RunContext } from "./run-context.js";
import type { CapabilityStore } from "../backbone/capability-store.js";
import type { OrgConfig } from "../schema/index.js";
/**
 * Minimal runtime shape needed to run the middleware pipeline (avoids circular import with bootstrap).
 */
export interface RuntimeWithMiddleware {
    config: OrgConfig;
    capabilities: Map<string, CapabilityInstance>;
    capabilityStore?: CapabilityStore;
    metricsStore?: CapabilityStore;
    agentMiddleware?: AgentMiddleware[];
    capabilityMiddleware?: CapabilityMiddleware[];
}
export interface AgentMiddlewareContext {
    agentId: string;
    action: string;
    input: CapabilityInput;
    runContext: RunContext;
    runtime: RuntimeWithMiddleware;
}
export interface CapabilityMiddlewareContext {
    capabilityId: string;
    input: CapabilityInput;
    runContext: RunContext;
    runtime: RuntimeWithMiddleware;
    /** Set when the capability is invoked from an agent step (workflow or build). */
    agentId?: string;
}
export type AgentMiddleware = (ctx: AgentMiddlewareContext, next: () => Promise<CapabilityOutput>) => Promise<CapabilityOutput>;
export type CapabilityMiddleware = (ctx: CapabilityMiddlewareContext, next: () => Promise<CapabilityOutput>) => Promise<CapabilityOutput>;
/**
 * Run the agent middleware pipeline; final next is the actual capability execution.
 */
export declare function runAgentPipeline(middlewares: AgentMiddleware[], ctx: AgentMiddlewareContext, next: () => Promise<CapabilityOutput>): Promise<CapabilityOutput>;
/**
 * Run the capability middleware pipeline; final next is the actual instance.execute.
 */
export declare function runCapabilityPipeline(middlewares: CapabilityMiddleware[], ctx: CapabilityMiddlewareContext, next: () => Promise<CapabilityOutput>): Promise<CapabilityOutput>;
/**
 * Execute a capability through the capability middleware pipeline (if any), then instance.execute.
 * Used by createAgent and by createRunContext's invokeCapability.
 */
export declare function executeCapabilityWithMiddleware(runtime: RuntimeWithMiddleware, capabilityId: string, instance: CapabilityInstance, input: CapabilityInput, runContext: RunContext, agentId?: string): Promise<CapabilityOutput>;
//# sourceMappingURL=middleware.d.ts.map