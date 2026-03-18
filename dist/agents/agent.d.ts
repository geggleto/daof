import type { CapabilityInput, CapabilityInstance, CapabilityOutput } from "../types/json.js";
import type { RunContext } from "../runtime/run-context.js";
import type { RuntimeWithMiddleware } from "../runtime/middleware.js";
export interface Agent {
    readonly id: string;
    readonly provider: string;
    readonly model: string;
    readonly role: string;
    readonly fallback: string | undefined;
    readonly maxConcurrentTasks: number | undefined;
    invoke(action: string, input?: CapabilityInput, runContext?: RunContext): Promise<CapabilityOutput>;
}
export declare function createAgent(id: string, provider: string, model: string, role: string, capabilities: Map<string, CapabilityInstance>, fallback: string | undefined, maxConcurrentTasks: number | undefined, runtime: RuntimeWithMiddleware): Agent;
//# sourceMappingURL=agent.d.ts.map