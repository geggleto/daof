/**
 * Shared prompt builders for Planner, Generator, and Verifier (used by build module and by bundled capabilities).
 */
export function promptPlanner(description: string): string {
  return `You are a Planner for the DAOF (Declarative Agentic Orchestration Framework). Given a user request, produce a short Product Requirements Document (PRD) that states exactly what will be generated: which capabilities (tools/skills), which agents, and which workflows. Be concise. Output only the PRD text, no code. Do not propose capabilities that already exist in the org (assume current org has: text_generator, logger, and any other common tools). If the request is vague, list reasonable defaults.

User request: ${description}`;
}

export function promptGenerator(
  description: string,
  prd: string,
  existingCapabilities: string[]
): string {
  const existingList = existingCapabilities.length ? existingCapabilities.join(", ") : "none";
  return `You are a Generator for the DAOF. Generate a single YAML document with exactly three top-level keys: capabilities, agents, workflows. Each key is a map (id -> definition). Follow this PRD and the user request. Do NOT add capabilities that already exist. Existing capability ids in the org: ${existingList}.

PRD:
${prd}

User request: ${description}

You MUST put the complete YAML in this response. Do NOT write to a file or respond with only a summary or a path. Output the YAML in one of these ways:
- Raw YAML only (no markdown), or
- A single fenced code block: \`\`\`yaml ... \`\`\` containing the full document.

Required shape (three top-level keys):
capabilities:
  <id>:
    type: tool | skill | hybrid
    description: ...
    # config, prompt (for skills), depends_on as needed
agents:
  <id>:
    provider: cursor
    model: auto
    role: "..."
    capabilities: [{ name: "<capability_id>" }]
workflows:
  <id>:
    trigger: cron(* * * * *) or event(name)
    steps: [...]

Generate in order: capabilities first (so agents can reference them), then agents, then workflows (so workflows reference existing agents and actions).`;
}

export function promptVerifier(prd: string, mergedYamlSummary: string): string {
  return `You are a Verifier for the DAOF. Given the PRD and the generated org summary, answer with exactly "PASS" or "FAIL". If the generated output satisfies the PRD and user request, reply PASS. If something is missing or wrong, reply FAIL.

PRD:
${prd}

Generated org summary (capabilities, agents, workflows added):
${mergedYamlSummary}

Reply with exactly one word: PASS or FAIL`;
}

/**
 * Prompt for similarity/dedupe check. Input is JSON string of proposed + existing capabilities and agents.
 * Asks LLM to output JSON only: { "duplicates": [ { "id1": string, "id2": string, "type": "capability"|"agent", "reason": string } ] }.
 */
export function promptSimilarity(proposedAndExistingJson: string): string {
  return `You are a similarity checker for the DAOF. Given proposed (new) and existing capability and agent definitions, list any pairs that are semantically duplicate or near-duplicate (same intent, different id). Compare only within the same type (capability vs capability, agent vs agent). Do not flag proposed vs existing as duplicate unless they are truly the same; we want to avoid having two new capabilities that do the same thing.

Input (JSON):
${proposedAndExistingJson}

Output only valid JSON in this exact shape (no markdown, no explanation):
{"duplicates":[{"id1":"<id>","id2":"<id>","type":"capability|agent","reason":"<short reason>"}]}

If there are no duplicates, output: {"duplicates":[]}`;
}

/**
 * Prompt for generating capability implementation code. Output must be a single default-exported factory.
 */
export function promptCapabilityCodegen(
  id: string,
  description: string,
  configJson: string,
  dependsOn: string[]
): string {
  const deps = dependsOn.length ? dependsOn.join(", ") : "none";
  return `You are a code generator for the DAOF. Generate a TypeScript module that implements the following capability.

Capability id: ${id}
Description: ${description}
Config: ${configJson}
depends_on (capability ids this may invoke): ${deps}

Requirements:
- Default export must be a function: (capabilityId: string, def: CapabilityDefinition) => CapabilityInstance
- Use types from the DAOF codebase: CapabilityInstance, CapabilityInput, CapabilityOutput, RunContext (from ../../types/json.js and ../../runtime/run-context.js), CapabilityDefinition (from ../../schema/index.js).
- The returned instance must have an execute(input, runContext?) method that returns Promise<CapabilityOutput>. Every code path in execute must return a value (e.g. return { ok: true }; or a real result); never leave execute without a return.
- To call another capability use runContext.invokeCapability(capabilityId, input) (only for ids in depends_on).
- Output only the TypeScript code, in a single \`\`\`typescript code block. No explanation outside the block.`;
}
