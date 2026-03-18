import { DEFAULT_HEARTBEAT_INTERVAL_SECONDS, DEFAULT_MAX_CONCURRENT_WORKFLOWS, } from "../schema/index.js";
import { writeOrgFile } from "../parser/index.js";
import { startHeartbeat, onHeartbeatRunDueWorkflows, startEventSubscriber } from "../workflow/scheduler.js";
import { createInMemoryWorkflowSemaphore } from "../backbone/semaphore.js";
/**
 * Run the org scheduler: heartbeat for cron workflows, event subscriber for event-triggered workflows.
 * Uses backbone adapter's createWorkflowSemaphore/createRunRegistry when present (e.g. Redis);
 * otherwise falls back to in-memory semaphore and no run registry.
 * Resolves after setup; process stays alive until SIGINT/SIGTERM.
 */
export async function runScheduler(runtime, options) {
    const heartbeatInterval = runtime.config.scheduler?.heartbeat_interval_seconds ?? DEFAULT_HEARTBEAT_INTERVAL_SECONDS;
    const maxConcurrent = runtime.config.scheduler?.max_concurrent_workflows ?? DEFAULT_MAX_CONCURRENT_WORKFLOWS;
    const semaphore = runtime.backbone?.createWorkflowSemaphore?.(maxConcurrent)
        ?? createInMemoryWorkflowSemaphore(maxConcurrent);
    const runRegistry = runtime.backbone?.createRunRegistry?.() ?? null;
    const stopHeartbeat = startHeartbeat(runtime, async (payload) => {
        await onHeartbeatRunDueWorkflows(runtime, payload, semaphore, runRegistry);
    });
    const stopEventSubscriber = runtime.backbone
        ? await startEventSubscriber(runtime, semaphore, runRegistry)
        : () => { };
    const shutdown = () => {
        stopHeartbeat();
        stopEventSubscriber();
        let syncFailed = false;
        if (runtime.orgFilePath) {
            try {
                writeOrgFile(runtime.orgFilePath, runtime.config);
            }
            catch (err) {
                syncFailed = true;
                console.error("[daof] Failed to sync org config to file on shutdown:", err instanceof Error ? err.message : err);
            }
        }
        options?.onBeforeShutdown?.();
        process.exit(syncFailed ? 1 : 0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
    console.log(`Scheduler running (heartbeat every ${heartbeatInterval}s, max ${maxConcurrent} concurrent workflow(s)). Ctrl+C to stop.`);
}
//# sourceMappingURL=run-org.js.map