import { runAgentPipeline, executeCapabilityWithMiddleware, } from "../runtime/middleware.js";
export function createAgent(id, provider, model, role, capabilities, fallback, maxConcurrentTasks, runtime) {
    return {
        id,
        provider,
        model,
        role,
        fallback,
        maxConcurrentTasks,
        async invoke(action, input, runContext) {
            const cap = capabilities.get(action);
            if (!cap) {
                throw new Error(`Agent "${id}" has no capability "${action}"`);
            }
            const doInvoke = () => executeCapabilityWithMiddleware(runtime, action, cap, input ?? {}, runContext ?? { invokeCapability: async () => ({}) }, id);
            const agentMiddlewares = runtime.agentMiddleware ?? [];
            if (agentMiddlewares.length === 0) {
                return doInvoke();
            }
            return runAgentPipeline(agentMiddlewares, {
                agentId: id,
                action,
                input: input ?? {},
                runContext: runContext ?? { invokeCapability: async () => ({}) },
                runtime,
            }, doInvoke);
        },
    };
}
//# sourceMappingURL=agent.js.map