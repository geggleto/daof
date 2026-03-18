import type { OrgConfig } from "../schema/index.js";
import type { ParsedYaml } from "../types/json.js";
/** Strip optional markdown fenced code block (yaml or plain) from LLM response. Kept as fallback. */
export declare function stripCodeFence(text: string): string;
/** Remove lines that look like markdown so they don't break YAML. Kept as fallback when no fenced block. */
export declare function stripMarkdownLines(text: string): string;
/** True if the string looks like the start of our generated YAML (capabilities/agents/workflows). */
export declare function looksLikeYamlContent(text: string): boolean;
/**
 * If the generator response mentions a .yaml/.yml file path (e.g. "generated at `path/to/file.yaml`"),
 * return that path for use as a fallback. Path is returned as-is (relative or absolute).
 */
export declare function findMentionedYamlPath(text: string): string | undefined;
/**
 * Extract YAML from markdown using the marked lexer. Prefer the first fenced code block with lang yaml/yml;
 * otherwise the first code block. If none, fall back to stripCodeFence + stripMarkdownLines.
 */
export declare function extractYamlFromMarkdown(text: string): string;
/**
 * Extract the first fenced code block from markdown. If preferLang is set (e.g. "typescript"),
 * return the first block with that language (or "ts" for typescript); otherwise return the first block.
 */
export declare function extractCodeBlock(text: string, preferLang?: string): string | undefined;
export interface ExtractedGenerated {
    capabilities: Record<string, unknown>;
    agents: Record<string, unknown>;
    workflows: Record<string, unknown>;
}
/** Extract capabilities, workflows, agents from parsed generator output (may be wrapped in code block). */
export declare function extractGenerated(parsed: ParsedYaml): ExtractedGenerated;
/** Merge generated into existing org. Order: capabilities, then agents, then workflows. */
export declare function mergeIntoConfig(config: OrgConfig, generated: ExtractedGenerated): OrgConfig;
//# sourceMappingURL=merge.d.ts.map