/**
 * Shared prompt builders for Planner, Generator, and Verifier (used by build module and by bundled capabilities).
 */
export declare function promptPlanner(description: string): string;
/**
 * Prompt for revising an existing PRD from user feedback (used by daof plan interactive loop).
 */
export declare function promptPlannerRevise(prd: string, userFeedback: string): string;
export declare function promptGenerator(description: string, prd: string, existingCapabilities: string[]): string;
export declare function promptVerifier(prd: string, mergedYamlSummary: string): string;
/**
 * Prompt for similarity/dedupe check. Input is JSON string of proposed + existing capabilities and agents.
 * Asks LLM to output JSON only: { "duplicates": [ { "id1": string, "id2": string, "type": "capability"|"agent", "reason": string } ] }.
 */
export declare function promptSimilarity(proposedAndExistingJson: string): string;
/**
 * Prompt for generating capability implementation code. Output must be a single default-exported factory.
 */
export declare function promptCapabilityCodegen(id: string, description: string, configJson: string, dependsOn: string[]): string;
//# sourceMappingURL=prompts.d.ts.map