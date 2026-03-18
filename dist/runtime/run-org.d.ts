import type { OrgRuntime } from "./bootstrap.js";
export interface RunSchedulerOptions {
    /** Called during shutdown before process.exit(0). Use for e.g. removing PID file. */
    onBeforeShutdown?: () => void;
}
/**
 * Run the org scheduler: heartbeat for cron workflows, event subscriber for event-triggered workflows.
 * Uses backbone adapter's createWorkflowSemaphore/createRunRegistry when present (e.g. Redis);
 * otherwise falls back to in-memory semaphore and no run registry.
 * Resolves after setup; process stays alive until SIGINT/SIGTERM.
 */
export declare function runScheduler(runtime: OrgRuntime, options?: RunSchedulerOptions): Promise<void>;
//# sourceMappingURL=run-org.d.ts.map