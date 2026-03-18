import { MemorySaver } from "@langchain/langgraph";
import { buildWorkflowGraph } from "./graph-builder.js";
function generateRunId() {
    return typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
/**
 * Run a workflow using LangGraph. Builds a StateGraph from the workflow definition,
 * compiles with a checkpointer (MemorySaver), and invokes with thread_id for
 * persistence and resume. When runRegistry is set, registers the run for kill
 * and checks cancel between steps. Passes __event_id and __run_id in context for traceability.
 */
export async function runWorkflowWithLangGraph(runtime, workflowId, initialInput, runId, options) {
    const workflow = runtime.config.workflows[workflowId];
    if (!workflow) {
        throw new Error(`Workflow not found: ${workflowId}`);
    }
    const id = runId ?? generateRunId();
    const threadId = `${workflowId}:${id}`;
    const runRegistry = options?.runRegistry ?? null;
    const initialWithIds = {
        ...(initialInput && typeof initialInput === "object" ? initialInput : {}),
        __run_id: id,
    };
    const initialContext = { __initial: initialWithIds };
    if (runRegistry) {
        await runRegistry.register(id);
    }
    if (runtime.ticketStore) {
        await runtime.ticketStore.create(id, {
            workflow_id: workflowId,
            run_id: id,
            initial_input: initialInput && typeof initialInput === "object" ? initialInput : undefined,
        });
    }
    const graphBuilder = buildWorkflowGraph(runtime, workflow, runRegistry, workflowId);
    const checkpointer = options?.checkpointer ?? new MemorySaver();
    const compiled = graphBuilder.compile({ checkpointer });
    const invoke = async () => {
        const result = await compiled.invoke({ context: initialContext }, { configurable: { thread_id: threadId, run_id: id } });
        return result;
    };
    try {
        const finalState = options?.circuitBreaker
            ? await options.circuitBreaker.execute(invoke)
            : await invoke();
        if (finalState === undefined) {
            throw new Error("Circuit breaker returned undefined");
        }
        const finalContext = finalState.context ?? {};
        if (runtime.checkpointStore && workflow.steps.length > 0) {
            await runtime.checkpointStore.save(workflowId, id, workflow.steps.length - 1, finalContext);
        }
        if (runtime.ticketStore) {
            await runtime.ticketStore.setStatus(id, "completed");
        }
        return {
            success: true,
            context: finalContext,
            runId: id,
        };
    }
    catch (err) {
        if (runtime.ticketStore) {
            await runtime.ticketStore.setStatus(id, "failed");
        }
        return {
            success: false,
            context: initialContext,
            error: err instanceof Error ? err : new Error(String(err)),
            runId: id,
        };
    }
    finally {
        if (runRegistry) {
            await runRegistry.unregister(id);
        }
    }
}
//# sourceMappingURL=langgraph-runner.js.map