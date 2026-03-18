import type { OrgRuntime } from "../runtime/bootstrap.js";
export interface RunBuildOptions {
    orgFilePath: string;
    yolo: boolean;
    providerId: string;
    viaEvents?: boolean;
    /** When set, skip the Planner step and use this PRD; continue from review gate. */
    initialPrd?: string;
    /** Verbosity: 0 = normal, 1 = PRD always shown, 2 = generator/verifier summary, 3 = raw LLM responses */
    verbose?: number;
    /** Disable capability codegen (default: codegen is on). */
    noCodegen?: boolean;
    /** Directory for generated capability source files (default: generated/capabilities). */
    codegenDir?: string;
    /** Add generated capability to framework source (src/capabilities/bundled) and register in index; requires running from repo root. */
    bundle?: boolean;
}
export interface RunPlannerOptions {
    runtime: OrgRuntime;
    providerId: string;
    verbose?: number;
}
/**
 * Run the Planner only (agent or direct LLM). Returns PRD text or throws.
 * Used by runBuild and by the daof plan CLI.
 */
export declare function runPlanner(description: string, options: RunPlannerOptions): Promise<string>;
/**
 * Revise an existing PRD from user feedback (direct LLM only). Returns updated PRD or throws.
 * Used by daof plan interactive loop.
 */
export declare function runPlannerRevise(prd: string, userFeedback: string, options: {
    providerId: string;
    verbose?: number;
}): Promise<string>;
export interface RunBuildResult {
    success: boolean;
    addedCount?: number;
    error?: Error;
}
/**
 * Run the full build flow: Planner → review (unless yolo) → Generator → parse → merge → validate → write → Verifier.
 * Uses org-level planner/generator/builder/verifier agents when present; otherwise direct LLM.
 * On Verifier fail, retries up to MAX_VERIFIER_RETRIES then returns success: false.
 */
export declare function runBuild(description: string, options: RunBuildOptions): Promise<RunBuildResult>;
//# sourceMappingURL=index.d.ts.map