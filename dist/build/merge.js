/**
 * Shared merge helpers for build flow (used by build module and by merge_and_write capability).
 */
import { lexer } from "marked";
/** Strip optional markdown fenced code block (yaml or plain) from LLM response. Kept as fallback. */
export function stripCodeFence(text) {
    const trimmed = text.trim();
    const fence = trimmed.startsWith("```");
    if (!fence)
        return trimmed;
    const firstLineEnd = trimmed.indexOf("\n");
    const rest = firstLineEnd >= 0 ? trimmed.slice(firstLineEnd + 1) : "";
    const closeIndex = rest.indexOf("```");
    if (closeIndex < 0)
        return trimmed;
    return rest.slice(0, closeIndex).trim();
}
/** Remove lines that look like markdown so they don't break YAML. Kept as fallback when no fenced block. */
export function stripMarkdownLines(text) {
    const lines = text.split("\n");
    const out = [];
    for (const line of lines) {
        const t = line.trim();
        if (/^\*\*[^*]+\*\*:?\s*$/.test(t))
            continue;
        if (/^#+\s+.+$/.test(t))
            continue;
        if (/^[-=]{2,}\s*$/.test(t))
            continue;
        if (/^-\s*`/.test(t))
            continue;
        if (/^```(\w*)\s*$/.test(t))
            continue;
        if (/^\d+\.\s+.+$/.test(t))
            continue; // numbered list lines
        out.push(line);
    }
    return out.join("\n").trim();
}
/** True if the string looks like the start of our generated YAML (capabilities/agents/workflows). */
export function looksLikeYamlContent(text) {
    const t = text.trim();
    return /^(capabilities|agents|workflows)\s*:/.test(t) || /^#.*\n(capabilities|agents|workflows)\s*:/.test(t);
}
/**
 * If the generator response mentions a .yaml/.yml file path (e.g. "generated at `path/to/file.yaml`"),
 * return that path for use as a fallback. Path is returned as-is (relative or absolute).
 */
export function findMentionedYamlPath(text) {
    const backtickMatch = text.match(/`([^`]+\.ya?ml)`/i);
    if (backtickMatch)
        return backtickMatch[1].trim();
    const atMatch = text.match(/(?:generated at|written to|saved to|at)\s+['"]?([^\s'"]+\.ya?ml)['"]?/i);
    if (atMatch)
        return atMatch[1].trim();
    return undefined;
}
/**
 * Extract YAML from markdown using the marked lexer. Prefer the first fenced code block with lang yaml/yml;
 * otherwise the first code block. If none, fall back to stripCodeFence + stripMarkdownLines.
 */
export function extractYamlFromMarkdown(text) {
    const trimmed = text.trim();
    if (!trimmed)
        return trimmed;
    try {
        const tokens = lexer(trimmed);
        for (const token of tokens) {
            if (token.type === "code" && "text" in token && typeof token.text === "string") {
                const t = token;
                const lang = (t.lang ?? "").toLowerCase();
                if (lang === "yaml" || lang === "yml" || !lang)
                    return t.text.trim();
            }
        }
    }
    catch {
        /* lexer can throw on very broken input; fall through to fallback */
    }
    return stripMarkdownLines(stripCodeFence(trimmed));
}
/**
 * Extract the first fenced code block from markdown. If preferLang is set (e.g. "typescript"),
 * return the first block with that language (or "ts" for typescript); otherwise return the first block.
 */
export function extractCodeBlock(text, preferLang) {
    const trimmed = text.trim();
    if (!trimmed)
        return undefined;
    try {
        const tokens = lexer(trimmed);
        for (const token of tokens) {
            if (token.type === "code" && "text" in token && typeof token.text === "string") {
                const t = token;
                const lang = (t.lang ?? "").toLowerCase();
                if (preferLang) {
                    const want = preferLang.toLowerCase();
                    if (lang === want || (want === "typescript" && lang === "ts"))
                        return t.text.trim();
                }
                else {
                    return t.text.trim();
                }
            }
        }
        if (preferLang) {
            for (const token of tokens) {
                if (token.type === "code" && "text" in token && typeof token.text === "string")
                    return token.text.trim();
            }
        }
    }
    catch {
        /* ignore */
    }
    return undefined;
}
/** Extract capabilities, workflows, agents from parsed generator output (may be wrapped in code block). */
export function extractGenerated(parsed) {
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { capabilities: {}, agents: {}, workflows: {} };
    }
    const obj = parsed;
    const capabilities = obj.capabilities && typeof obj.capabilities === "object" && !Array.isArray(obj.capabilities)
        ? obj.capabilities
        : {};
    const agents = obj.agents && typeof obj.agents === "object" && !Array.isArray(obj.agents)
        ? obj.agents
        : {};
    const workflows = obj.workflows && typeof obj.workflows === "object" && !Array.isArray(obj.workflows)
        ? obj.workflows
        : {};
    return { capabilities, agents, workflows };
}
/** Merge generated into existing org. Order: capabilities, then agents, then workflows. */
export function mergeIntoConfig(config, generated) {
    return {
        ...config,
        capabilities: { ...config.capabilities, ...generated.capabilities },
        agents: { ...config.agents, ...generated.agents },
        workflows: { ...config.workflows, ...generated.workflows },
    };
}
//# sourceMappingURL=merge.js.map