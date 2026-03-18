/** Thrown when a workflow run is cancelled via daof kill <run_id>. */
export class WorkflowCancelledError extends Error {
    runId;
    constructor(runId) {
        super(`Workflow run cancelled: ${runId}`);
        this.runId = runId;
        this.name = "WorkflowCancelledError";
    }
}
//# sourceMappingURL=types.js.map