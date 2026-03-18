import type { OrgRuntime } from "../runtime/bootstrap.js";
/** Run Planner via agent; return prd or throw. */
export declare function runPlannerAgent(runtime: OrgRuntime, description: string): Promise<string>;
/** Run Generator via agent; return yaml text or throw. */
export declare function runGeneratorAgent(runtime: OrgRuntime, description: string, prd: string, existingCapabilityIds: string[]): Promise<string>;
/** Run merge_and_write via builder agent; return { summary, added_count } or throw. */
export declare function runMergeAndWriteAgent(runtime: OrgRuntime, orgFilePath: string, generatedYaml: string): Promise<{
    summary: string;
    added_count: number;
}>;
/** Run Verifier via agent; return true if pass. */
export declare function runVerifierAgent(runtime: OrgRuntime, prd: string, summary: string): Promise<boolean>;
//# sourceMappingURL=agents.d.ts.map