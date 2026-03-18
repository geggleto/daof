import { createScopedCapabilityStore, } from "../backbone/capability-store.js";
import { executeCapabilityWithMiddleware } from "./middleware.js";
/**
 * Build a RunContext for the given capability. InvokeCapability is scoped to that
 * capability's depends_on; nested invocations get their own RunContext and inherit agentLlm when provided.
 * When runInfo and ticketStore are present, context.ticket allows appending updates to the run ticket.
 * When stepId/runId/agentId are provided (workflow executor), capabilities can use them for step/run/agent-scoped identifiers.
 */
export function createRunContext(deps, currentCapabilityId, agentLlm, runInfo, stepId, runId, agentId) {
    const def = deps.config.capabilities[currentCapabilityId];
    const allowed = def?.depends_on ?? [];
    const invokeCapability = async (capabilityId, input) => {
        if (!allowed.includes(capabilityId)) {
            throw new Error(`Capability "${currentCapabilityId}" may not invoke "${capabilityId}" (not in depends_on).`);
        }
        const target = deps.capabilities.get(capabilityId);
        if (!target) {
            throw new Error(`Capability not found: ${capabilityId}`);
        }
        const nestedRunContext = createRunContext(deps, capabilityId, agentLlm, runInfo, undefined, runId, agentId);
        const hasCapabilityMiddleware = deps.capabilityMiddleware && deps.capabilityMiddleware.length > 0;
        if (hasCapabilityMiddleware && deps.capabilityMiddleware) {
            return executeCapabilityWithMiddleware(deps, capabilityId, target, input ?? {}, nestedRunContext);
        }
        return target.execute(input ?? {}, nestedRunContext);
    };
    const hasPersistence = def?.persistence != null && String(def.persistence).trim() !== "";
    const capabilityStore = hasPersistence && deps.capabilityStore
        ? createScopedCapabilityStore(currentCapabilityId, deps.capabilityStore)
        : undefined;
    const daemonContext = {};
    if (deps.orgFilePath != null && deps.orgFilePath !== "") {
        daemonContext.updateOrgConfig = (config) => {
            deps.config = config;
        };
        daemonContext.getCurrentOrgConfig = () => deps.config;
    }
    const ticketContext = {};
    if (deps.ticketStore && runInfo) {
        ticketContext.ticket = {
            id: runInfo.runId,
            append: (update) => deps.ticketStore.appendUpdate(runInfo.runId, update),
        };
    }
    return {
        ...(deps.backbone && { backbone: deps.backbone }),
        invokeCapability,
        ...(capabilityStore && { capabilityStore }),
        ...(deps.metricsStore && { metricsStore: deps.metricsStore }),
        ...(agentLlm && { agentLlm }),
        ...(deps.registry && { registry: deps.registry }),
        ...daemonContext,
        ...ticketContext,
        ...(stepId != null && stepId !== "" && { stepId }),
        ...(runId != null && runId !== "" && { runId }),
        ...(agentId != null && agentId !== "" && { agentId }),
    };
}
//# sourceMappingURL=run-context.js.map