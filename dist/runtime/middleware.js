/**
 * Run the agent middleware pipeline; final next is the actual capability execution.
 */
export async function runAgentPipeline(middlewares, ctx, next) {
    if (middlewares.length === 0)
        return next();
    let i = 0;
    const runNext = () => {
        if (i >= middlewares.length)
            return next();
        const m = middlewares[i++];
        return m(ctx, runNext);
    };
    return runNext();
}
/**
 * Run the capability middleware pipeline; final next is the actual instance.execute.
 */
export async function runCapabilityPipeline(middlewares, ctx, next) {
    if (middlewares.length === 0)
        return next();
    let i = 0;
    const runNext = () => {
        if (i >= middlewares.length)
            return next();
        const m = middlewares[i++];
        return m(ctx, runNext);
    };
    return runNext();
}
/**
 * Execute a capability through the capability middleware pipeline (if any), then instance.execute.
 * Used by createAgent and by createRunContext's invokeCapability.
 */
export async function executeCapabilityWithMiddleware(runtime, capabilityId, instance, input, runContext, agentId) {
    const middlewares = runtime.capabilityMiddleware ?? [];
    const ctx = {
        capabilityId,
        input,
        runContext,
        runtime,
        ...(agentId !== undefined && { agentId }),
    };
    const next = () => instance.execute(input, runContext);
    return runCapabilityPipeline(middlewares, ctx, next);
}
//# sourceMappingURL=middleware.js.map