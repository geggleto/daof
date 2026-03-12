/**
 * Build flow: Planner (PRD) → review (unless --yolo) → Generator → merge → validate → write → Verifier.
 * On Verifier fail, retry up to 5 times then exit with error.
 * Uses org-level planner/generator/builder/verifier agents when present; otherwise falls back to direct LLM.
 * If the org file does not exist, a minimal scaffold is created and written before the build runs.
 */
import * as readline from "node:readline";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, basename, join } from "node:path";
import ora from "ora";
import { getProviderService, getProviderApiKey } from "../providers/registry.js";
import type { OrgConfig } from "../schema/index.js";
import {
  loadYaml,
  validate,
  parseYamlString,
  writeOrgFile,
} from "../parser/index.js";
import type { ParsedYaml } from "../types/json.js";
import { promptPlanner, promptGenerator, promptVerifier, promptCapabilityCodegen } from "./prompts.js";
import { extractYamlFromMarkdown, looksLikeYamlContent, findMentionedYamlPath, extractGenerated, mergeIntoConfig, extractCodeBlock } from "./merge.js";
import { createVerifySimilarityInstance, type SimilarityDuplicate } from "../capabilities/bundled/verify_similarity.js";
import { BUNDLED_IDS } from "../capabilities/bundled/index.js";
import { bootstrap } from "../runtime/bootstrap.js";
import type { OrgRuntime } from "../runtime/bootstrap.js";
import { createRunContext } from "../runtime/run-context.js";
import { createBackbone } from "../backbone/factory.js";
import { resolveEnv } from "../config/resolve-env.js";

const MAX_VERIFIER_RETRIES = 5;
const BUILD_REPLY_TIMEOUT_MS = 120_000;
const DEFAULT_EVENTS_QUEUE = "events";

function getEventsQueueName(config: OrgConfig): string {
  const queues = config.backbone?.config?.queues;
  if (Array.isArray(queues)) {
    const named = queues.find((q) => q?.name === DEFAULT_EVENTS_QUEUE);
    if (named) return named.name;
    if (queues[0] && typeof queues[0].name === "string") return queues[0].name;
  }
  return DEFAULT_EVENTS_QUEUE;
}

function randomRequestId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
const BUILD_AGENT_IDS = ["planner", "generator", "builder", "verifier"] as const;

/** Minimal valid org used when the target org file does not exist. */
function createScaffoldOrgConfig(): OrgConfig {
  return validate({
    version: "1.0",
    org: {
      name: "Scaffold",
      description: "Org created by daof build (scaffold)",
      goals: [],
    },
    agents: {},
    capabilities: {},
    workflows: {},
    backbone: {
      type: "redis",
      config: {
        url: "redis://localhost:6379",
        queues: [{ name: "events", type: "pubsub" }],
      },
    },
  } as unknown as ParsedYaml);
}

function isENOENT(err: unknown): boolean {
  return err != null && typeof err === "object" && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT";
}

function askProceed(): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question("Proceed? (y/n) ", (answer) => {
      rl.close();
      const normalized = answer?.trim().toLowerCase();
      resolve(normalized === "y" || normalized === "yes");
    });
  });
}

function hasBuildAgents(runtime: OrgRuntime): boolean {
  return BUILD_AGENT_IDS.every((id) => runtime.agents.has(id));
}

/** Run codegen for one capability; retries up to CODEGEN_RETRIES. Returns code string or throws. */
async function runCodegenForOne(
  providerId: string,
  id: string,
  def: { description?: string; config?: Record<string, unknown>; depends_on?: string[] },
  verbose: number
): Promise<string> {
  const apiKey = getProviderApiKey(providerId);
  const service = getProviderService(providerId, apiKey);
  if (!service) throw new Error("Codegen requires provider with API key.");
  const configJson = JSON.stringify(def.config ?? {}, null, 2);
  const dependsOn = def.depends_on ?? [];
  const description = def.description ?? "";
  let lastErr: Error | undefined;
  for (let r = 0; r < CODEGEN_RETRIES; r++) {
    try {
      const prompt = promptCapabilityCodegen(id, description, configJson, dependsOn);
      const result = await service.complete(prompt, { max_tokens: 4000 });
      if (!result || ("ok" in result && result.ok === false))
        throw new Error("ok" in result && result.ok === false ? result.error : "Codegen failed");
      const text = ("text" in result ? result.text : "").trim();
      const code = extractCodeBlock(text, "typescript") ?? extractCodeBlock(text);
      if (code) return code;
      throw new Error("No code block in response");
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (verbose >= 2) console.error("[build] Codegen attempt " + (r + 1) + "/" + CODEGEN_RETRIES + " for " + id + ": " + lastErr.message);
    }
  }
  throw new Error(
    "Capability codegen failed for " + id + " after " + CODEGEN_RETRIES + " attempts: " + (lastErr?.message ?? "Unknown error") + ". Check description/config and try again."
  );
}

/**
 * Run codegen for all new tool capabilities (not bundled). Loads config from org file, generates source files,
 * sets source on each capability, writes org file again. Returns true if any codegen was done.
 */
async function runCodegenPhase(
  providerId: string,
  orgFilePath: string,
  newCapabilityIds: string[],
  codegenDir: string,
  verbose: number
): Promise<{ didCodegen: boolean }> {
  const raw = loadYaml(orgFilePath);
  const config = validate(raw);
  let didCodegen = false;
  const dir = join(dirname(orgFilePath), codegenDir);
  mkdirSync(dir, { recursive: true });
  for (const id of newCapabilityIds) {
    const def = config.capabilities[id];
    if (!def || def.type !== "tool" || BUNDLED_IDS.has(id)) continue;
    const codegenSpinner = ora("Codegen " + id + "…").start();
    if (verbose >= 1) console.error("[build] Codegen " + id + "...");
    try {
      const code = await runCodegenForOne(providerId, id, def, verbose);
      const filePath = join(dir, id + ".ts");
      writeFileSync(filePath, code, "utf-8");
      (config.capabilities[id] as Record<string, unknown>).source = codegenDir + "/" + id + ".ts";
      didCodegen = true;
      codegenSpinner.succeed("Codegen " + id + " done.");
      if (verbose >= 1) console.error("[build] Codegen " + id + " done.");
    } catch (e) {
      codegenSpinner.fail("Codegen " + id + " failed.");
      throw e;
    }
  }
  if (didCodegen) writeOrgFile(orgFilePath, config);
  return { didCodegen };
}

/** Derive bundled factory name from capability id (snake_case -> createXxxInstance). */
function capabilityIdToFactoryName(id: string): string {
  const pascal = id
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join("");
  return "create" + pascal + "Instance";
}

/**
 * Normalize generated code from default export to named export for bundled use.
 * Replaces "export default function <AnyName>" with "export function createXxxInstance" and renames the function in the body.
 */
function normalizeBundledExport(code: string, factoryName: string): { code: string; usedNamedExport: boolean } {
  const match = code.match(/export\s+default\s+function\s+(\w+)/);
  if (!match) return { code, usedNamedExport: false };
  const oldName = match[1];
  let out = code.replace(/export\s+default\s+function\s+\w+/, `export function ${factoryName}`);
  const re = new RegExp("\\b" + oldName.replace(/\W/g, (c) => "\\" + c) + "\\b", "g");
  out = out.replace(re, factoryName);
  return { code: out, usedNamedExport: true };
}

const BUNDLED_INDEX_FILENAME = "index.ts";

/**
 * Patch src/capabilities/bundled/index.ts: add one import and one registry entry per new id.
 * Skips ids that are already present in the registry. Always uses named import so index stays consistent with bundled modules.
 */
function patchBundledIndex(
  bundledDir: string,
  additions: { id: string; factoryName: string; usedNamedExport: boolean }[],
  verbose: number
): void {
  if (additions.length === 0) return;
  const indexPath = join(bundledDir, BUNDLED_INDEX_FILENAME);
  let content = readFileSync(indexPath, "utf-8");

  const toAdd = additions.filter(({ id }) => {
    const already = content.includes(`${id}:`);
    if (already && verbose >= 1) console.error("[build] Bundled registry already has " + id + ", skipping.");
    return !already;
  });
  if (toAdd.length === 0) return;

  const importLines = toAdd
    .map(({ id, factoryName }) => `import { ${factoryName} } from "./${id}.js";`)
    .join("\n") + "\n";
  const lastImportMatch = content.match(/(.*\n)(import\s+.*?from\s+["'].*?["'];?\s*\n)([\s\S]*)/);
  const insertAfterImports = lastImportMatch
    ? lastImportMatch[1].length + lastImportMatch[2].length
    : 0;
  content = content.slice(0, insertAfterImports) + importLines + content.slice(insertAfterImports);

  const registryLines = toAdd.map(({ id, factoryName }) => `  ${id}: ${factoryName},`).join("\n") + "\n";
  const registryClose = content.indexOf("};");
  if (registryClose === -1) throw new Error("bundled index.ts: could not find registry closing };");
  content = content.slice(0, registryClose) + registryLines + content.slice(registryClose);

  writeFileSync(indexPath, content, "utf-8");
}

/**
 * Run codegen for new tool capabilities and write to framework src/capabilities/bundled/,
 * then patch the bundled index. Requires running from DAOF repo root. Does not set source on capabilities.
 */
async function runCodegenPhaseForBundle(
  providerId: string,
  orgFilePath: string,
  newCapabilityIds: string[],
  verbose: number
): Promise<{ didCodegen: boolean }> {
  const cwd = process.cwd();
  const bundledDir = join(cwd, "src", "capabilities", "bundled");
  const indexPath = join(bundledDir, BUNDLED_INDEX_FILENAME);
  if (!existsSync(indexPath)) {
    throw new Error(
      "Cannot use --bundle: run from the DAOF repo root so that src/capabilities/bundled exists."
    );
  }
  const raw = loadYaml(orgFilePath);
  const config = validate(raw);
  const additions: { id: string; factoryName: string; usedNamedExport: boolean }[] = [];
  let didCodegen = false;
  for (const id of newCapabilityIds) {
    const def = config.capabilities[id];
    if (!def || def.type !== "tool" || BUNDLED_IDS.has(id)) continue;
    const codegenSpinner = ora("Codegen " + id + " (bundle)…").start();
    if (verbose >= 1) console.error("[build] Codegen " + id + " (bundle)...");
    try {
      const code = await runCodegenForOne(providerId, id, def, verbose);
      const factoryName = capabilityIdToFactoryName(id);
      const { code: normalized, usedNamedExport } = normalizeBundledExport(code, factoryName);
      if (!usedNamedExport) {
        throw new Error(
          `Generated code for ${id} has no default-exported function; bundled capabilities must use "export default function ..." so the build can normalize to a named export.`
        );
      }
      const filePath = join(bundledDir, id + ".ts");
      writeFileSync(filePath, normalized, "utf-8");
      additions.push({ id, factoryName, usedNamedExport });
      didCodegen = true;
      codegenSpinner.succeed("Codegen " + id + " (bundle) done.");
      if (verbose >= 1) console.error("[build] Codegen " + id + " (bundle) done.");
    } catch (e) {
      codegenSpinner.fail("Codegen " + id + " (bundle) failed.");
      throw e;
    }
  }
  if (additions.length > 0) patchBundledIndex(bundledDir, additions, verbose);
  for (const { id } of additions) {
    const cap = config.capabilities[id] as Record<string, unknown> | undefined;
    if (cap) delete cap.source;
  }
  if (didCodegen) writeOrgFile(orgFilePath, config);
  return { didCodegen };
}

/** Run similarity check; returns list of duplicate pairs. On capability error, throws. */
async function runSimilarityCheck(
  providerId: string,
  config: OrgConfig,
  generated: { capabilities: Record<string, unknown>; agents: Record<string, unknown>; workflows: Record<string, unknown> }
): Promise<SimilarityDuplicate[]> {
  const apiKey = getProviderApiKey(providerId);
  const runContext = {
    agentLlm: { provider: providerId, model: "auto", apiKey },
  };
  const instance = createVerifySimilarityInstance("verify_similarity", {
    type: "tool",
    description: "Check for duplicate or near-duplicate capabilities/agents",
  });
  const out = await instance.execute(
    {
      proposed_capabilities: generated.capabilities as import("../types/json.js").JsonValue,
      existing_capabilities: config.capabilities as import("../types/json.js").JsonValue,
      proposed_agents: generated.agents as import("../types/json.js").JsonValue,
      existing_agents: config.agents as import("../types/json.js").JsonValue,
    },
    runContext
  );
  if (out && "ok" in out && out.ok === false) {
    throw new Error(typeof (out as { error?: string }).error === "string" ? (out as { error: string }).error : "Similarity check failed");
  }
  const duplicates = (out as { duplicates?: SimilarityDuplicate[] }).duplicates ?? [];
  return Array.isArray(duplicates) ? duplicates : [];
}

/** Run Planner via agent; return prd or throw. */
async function runPlannerAgent(
  runtime: OrgRuntime,
  description: string
): Promise<string> {
  const planner = runtime.agents.get("planner")!;
  const runContext = createRunContext(
    runtime,
    "produce_prd",
    { provider: planner.provider, model: planner.model, apiKey: getProviderApiKey(planner.provider) }
  );
  const out = await planner.invoke("produce_prd", { description }, runContext);
  if (out && "ok" in out && out.ok === false) {
    throw new Error(typeof (out as { error?: string }).error === "string" ? (out as { error: string }).error : "Planner failed");
  }
  const prd = typeof (out as { prd?: string }).prd === "string" ? (out as { prd: string }).prd : "";
  if (!prd) throw new Error("Planner returned empty PRD.");
  return prd;
}

/** Run Generator via agent; return yaml text or throw. */
async function runGeneratorAgent(
  runtime: OrgRuntime,
  description: string,
  prd: string,
  existingCapabilityIds: string[]
): Promise<string> {
  const generator = runtime.agents.get("generator")!;
  const runContext = createRunContext(
    runtime,
    "generate_yaml",
    { provider: generator.provider, model: generator.model, apiKey: getProviderApiKey(generator.provider) }
  );
  const out = await generator.invoke(
    "generate_yaml",
    { description, prd, existing_capabilities: existingCapabilityIds },
    runContext
  );
  if (out && "ok" in out && out.ok === false) {
    throw new Error(typeof (out as { error?: string }).error === "string" ? (out as { error: string }).error : "Generator failed");
  }
  const yaml = typeof (out as { yaml?: string }).yaml === "string" ? (out as { yaml: string }).yaml : "";
  if (!yaml) throw new Error("Generator returned empty response.");
  return yaml;
}

/** Run merge_and_write via builder agent; return { summary, added_count } or throw. */
async function runMergeAndWriteAgent(
  runtime: OrgRuntime,
  orgFilePath: string,
  generatedYaml: string
): Promise<{ summary: string; added_count: number }> {
  const builder = runtime.agents.get("builder")!;
  const runContext = createRunContext(
    runtime,
    "merge_and_write",
    { provider: builder.provider, model: builder.model, apiKey: getProviderApiKey(builder.provider) }
  );
  const out = await builder.invoke(
    "merge_and_write",
    { org_path: orgFilePath, generated_yaml: generatedYaml },
    runContext
  );
  if (out && "ok" in out && out.ok === false) {
    throw new Error(typeof (out as { error?: string }).error === "string" ? (out as { error: string }).error : "Merge failed");
  }
  const summary = typeof (out as { summary?: string }).summary === "string" ? (out as { summary: string }).summary : "";
  const added_count = typeof (out as { added_count?: number }).added_count === "number" ? (out as { added_count: number }).added_count : 0;
  return { summary, added_count };
}

/** Run Verifier via agent; return true if pass. */
async function runVerifierAgent(
  runtime: OrgRuntime,
  prd: string,
  summary: string
): Promise<boolean> {
  const verifier = runtime.agents.get("verifier")!;
  const runContext = createRunContext(
    runtime,
    "verify_build",
    { provider: verifier.provider, model: verifier.model, apiKey: getProviderApiKey(verifier.provider) }
  );
  const out = await verifier.invoke("verify_build", { prd, summary }, runContext);
  if (out && "ok" in out && out.ok === false) return false;
  return (out as { pass?: boolean }).pass === true;
}

const CODEGEN_RETRIES = 3;
const DEFAULT_CODEGEN_DIR = "generated/capabilities";

export interface RunBuildOptions {
  orgFilePath: string;
  yolo: boolean;
  providerId: string;
  viaEvents?: boolean;
  /** Verbosity: 0 = normal, 1 = PRD always shown, 2 = generator/verifier summary, 3 = raw LLM responses */
  verbose?: number;
  /** Disable capability codegen (default: codegen is on). */
  noCodegen?: boolean;
  /** Directory for generated capability source files (default: generated/capabilities). */
  codegenDir?: string;
  /** Add generated capability to framework source (src/capabilities/bundled) and register in index; requires running from repo root. */
  bundle?: boolean;
}

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
export async function runBuild(
  description: string,
  options: RunBuildOptions
): Promise<RunBuildResult> {
  const { orgFilePath, yolo, providerId } = options;
  const noCodegen = options.noCodegen ?? false;
  const codegenDir = options.codegenDir ?? DEFAULT_CODEGEN_DIR;
  const bundle = options.bundle ?? false;

  // 1. Load existing org, or create scaffold if file is missing
  let config: OrgConfig;
  let didScaffold = false;
  try {
    const raw = loadYaml(orgFilePath);
    config = validate(raw);
  } catch (err) {
    if (isENOENT(err)) {
      didScaffold = true;
      config = createScaffoldOrgConfig();
      try {
        mkdirSync(dirname(orgFilePath), { recursive: true });
        writeOrgFile(orgFilePath, config);
      } catch (writeErr) {
        return {
          success: false,
          error: writeErr instanceof Error ? writeErr : new Error(String(writeErr)),
        };
      }
      console.log(`Created scaffold org at ${orgFilePath}.`);
    } else {
      return {
        success: false,
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
  }

  const existingCapabilityIds = Object.keys(config.capabilities);
  const verbose = options.verbose ?? 0;

  if (verbose >= 1) {
    console.error(didScaffold ? `[build] Scaffolded org at ${orgFilePath}.` : `[build] Loaded org from ${orgFilePath}.`);
  }

  // Event mode: publish build.requested and wait for reply on build.replies (no interactive review).
  if (options.viaEvents) {
    if (!config.backbone) {
      return { success: false, error: new Error("--via-events requires backbone config in the org manifest.") };
    }
    const requestId = randomRequestId();
    const resolvedConfig = resolveEnv(config);
    const adapter = createBackbone(resolvedConfig.backbone!);
    await adapter.connect();
    try {
      let resolveReply: (v: Record<string, unknown>) => void;
      const replyPromise = new Promise<Record<string, unknown>>((resolve) => {
        resolveReply = resolve;
      });
      let unsub: () => void;
      const handler = (msg: string) => {
        try {
          const data = JSON.parse(msg) as Record<string, unknown>;
          if (data.request_id === requestId) {
            resolveReply(data);
            unsub();
          }
        } catch {
          /* ignore */
        }
      };
      unsub = await adapter.subscribe("build.replies", handler);
      const eventsQueue = getEventsQueueName(config);
      await adapter.publish(eventsQueue, {
        event_type: "build.requested",
        payload: {
          description,
          request_id: requestId,
          org_path: orgFilePath,
          existing_capabilities: existingCapabilityIds,
        },
      });
      if (verbose >= 1) console.error("[build] Published build.requested, waiting for reply...");
      const waitSpinner = ora("Waiting for build reply…").start();
      let reply: Record<string, unknown>;
      try {
        reply = await Promise.race([
          replyPromise,
          new Promise<never>((_, rej) =>
            setTimeout(() => rej(new Error(`Build reply timeout (${BUILD_REPLY_TIMEOUT_MS / 1000}s). Is the org running (daof run)?`)), BUILD_REPLY_TIMEOUT_MS)
          ),
        ]);
      } catch (err) {
        waitSpinner.fail("Timeout.");
        throw err;
      }
      const success = reply.success === true;
      const addedCount = typeof reply.added_count === "number" ? reply.added_count : 0;
      if (success) {
        waitSpinner.succeed("Build reply received.");
        if (verbose >= 1) console.error("[build] Build reply received (success).");
      } else {
        waitSpinner.fail("Build failed.");
        if (verbose >= 1) console.error("[build] Build reply received (failed).");
      }
      if (success && addedCount > 0) {
        console.log(`Added ${addedCount} capability/agent/workflow definition(s) to ${orgFilePath}.`);
      }
      if (!success && typeof reply.error === "string") {
        return { success: false, error: new Error(reply.error) };
      }
      return { success, addedCount: success ? addedCount : undefined };
    } finally {
      await adapter.disconnect();
    }
  }

  const runtime = await bootstrap(config);
  const useAgents = hasBuildAgents(runtime);

  if (!useAgents) {
    const apiKey = getProviderApiKey(providerId);
    const service = getProviderService(providerId, apiKey);
    if (!service) {
      return {
        success: false,
        error: new Error(
          `daof build requires a provider (e.g. ${providerId}) with API key. Set ${providerId === "cursor" ? "CURSOR_API_KEY" : "provider API key"} in the environment.`
        ),
      };
    }
  }

  // 2. Planner: generate PRD (agent or direct LLM)
  let prd: string;
  const plannerSpinner = ora("Planning…").start();
  if (verbose >= 1) console.error("[build] Running planner...");
  try {
    if (useAgents) {
      prd = await runPlannerAgent(runtime, description);
    } else {
      const service = getProviderService(providerId, getProviderApiKey(providerId))!;
      const plannerResult = await service.complete(promptPlanner(description), { max_tokens: 1500 });
      if (!plannerResult || ("ok" in plannerResult && plannerResult.ok === false)) {
        plannerSpinner.fail("Planner failed.");
        return {
          success: false,
          error: new Error("ok" in plannerResult && plannerResult.ok === false ? plannerResult.error : "Planner failed"),
        };
      }
      prd = ("text" in plannerResult ? plannerResult.text : "").trim();
      if (!prd) {
        plannerSpinner.fail("Planner returned empty PRD.");
        return { success: false, error: new Error("Planner returned empty PRD.") };
      }
    }
    plannerSpinner.succeed("Planner done.");
    if (verbose >= 1) console.error("[build] Planner done.");
  } catch (err) {
    plannerSpinner.fail("Planner failed.");
    return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
  }

  console.log("--- PRD ---");
  console.log(prd);
  console.log("-----------");

  // 3. Review (unless yolo)
  if (!yolo) {
    const proceed = await askProceed();
    if (!proceed) {
      console.log("Plan deleted. Exiting without changes.");
      return { success: true, addedCount: 0 };
    }
  }

  // 4–9. Loop: Generator → (parse/) merge → [codegen] → Verifier (up to 5 retries)
  let lastError: Error | undefined;
  for (let attempt = 0; attempt < MAX_VERIFIER_RETRIES; attempt++) {
    if (attempt > 0) {
      console.error(`Verifier did not pass; retrying generation (attempt ${attempt + 1}/${MAX_VERIFIER_RETRIES})…`);
    }
    let didCodegen = false;
    try {
      if (useAgents) {
        const genSpinner = ora(
          attempt > 0 ? `Retrying… (attempt ${attempt + 1}/${MAX_VERIFIER_RETRIES})` : `Generating… (attempt ${attempt + 1}/${MAX_VERIFIER_RETRIES})`
        ).start();
        if (verbose >= 1) console.error(`[build] Running generator (attempt ${attempt + 1}/${MAX_VERIFIER_RETRIES})...`);
        let yaml: string;
        try {
          yaml = await runGeneratorAgent(runtime, description, prd, existingCapabilityIds);
          genSpinner.succeed("Generator done.");
          if (verbose >= 1) console.error("[build] Generator done.");
        } catch (e) {
          genSpinner.fail("Generator failed.");
          throw e;
        }
        let generatedForMerge: ReturnType<typeof extractGenerated>;
        try {
          const parsedYaml = parseYamlString(extractYamlFromMarkdown(yaml));
          generatedForMerge = extractGenerated(parsedYaml);
        } catch (e) {
          lastError = e instanceof Error ? e : new Error(String(e));
          continue;
        }
        const simSpinner = ora("Checking similarity…").start();
        if (verbose >= 1) console.error("[build] Checking similarity...");
        try {
          const duplicates = await runSimilarityCheck(providerId, config, generatedForMerge);
          simSpinner.succeed("Similarity check done.");
          if (verbose >= 1) console.error("[build] Similarity check done.");
          if (duplicates.length > 0) {
            const msg = duplicates
              .map((d) => d.type + ": " + d.id1 + " vs " + d.id2 + (d.reason ? " (" + d.reason + ")" : ""))
              .join("; ");
            lastError = new Error("Similarity check found duplicate or near-duplicate definitions. Consolidate and retry: " + msg);
            continue;
          }
        } catch (e) {
          simSpinner.fail("Similarity check failed.");
          lastError = e instanceof Error ? e : new Error(String(e));
          continue;
        }
        const mergeSpinner = ora("Merging…").start();
        if (verbose >= 1) console.error("[build] Merging...");
        let mergeOut: { summary: string; added_count: number };
        try {
          mergeOut = await runMergeAndWriteAgent(runtime, orgFilePath, yaml);
          mergeSpinner.succeed(`Merge done. Added ${mergeOut.added_count} definition(s).`);
          if (verbose >= 1) console.error(`[build] Merge done. ${mergeOut.summary}`);
        } catch (e) {
          mergeSpinner.fail("Merge failed.");
          throw e;
        }
        if (!noCodegen) {
          const codegenResult = bundle
            ? await runCodegenPhaseForBundle(providerId, orgFilePath, Object.keys(generatedForMerge.capabilities), verbose)
            : await runCodegenPhase(providerId, orgFilePath, Object.keys(generatedForMerge.capabilities), codegenDir, verbose);
          didCodegen = codegenResult.didCodegen;
        }
        const verSpinner = ora("Verifying…").start();
        if (verbose >= 1) console.error("[build] Running verifier...");
        let pass: boolean;
        try {
          pass = await runVerifierAgent(runtime, prd, mergeOut.summary);
          if (pass) {
            verSpinner.succeed("Verifier pass.");
            if (verbose >= 1) console.error("[build] Verifier pass.");
          } else {
            verSpinner.fail("Verifier fail.");
            if (verbose >= 1) console.error("[build] Verifier fail.");
          }
        } catch (e) {
          verSpinner.fail("Verifier failed.");
          throw e;
        }
        if (pass) {
          if (didCodegen) console.log("Run `npm run build` to compile and include the new capabilities.");
          return { success: true, addedCount: mergeOut.added_count };
        }
        lastError = new Error(`Verifier failed (attempt ${attempt + 1}/${MAX_VERIFIER_RETRIES}).`);
      } else {
        const service = getProviderService(providerId, getProviderApiKey(providerId))!;
        const genSpinner = ora(
          attempt > 0 ? `Retrying… (attempt ${attempt + 1}/${MAX_VERIFIER_RETRIES})` : `Generating… (attempt ${attempt + 1}/${MAX_VERIFIER_RETRIES})`
        ).start();
        if (verbose >= 1) console.error(`[build] Running generator (attempt ${attempt + 1}/${MAX_VERIFIER_RETRIES})...`);
        const genResult = await service.complete(promptGenerator(description, prd, existingCapabilityIds), { max_tokens: 4000 });
        genSpinner.succeed("Generator done.");
        if (verbose >= 1) console.error("[build] Generator done.");
        if (!genResult || ("ok" in genResult && genResult.ok === false)) {
          lastError = new Error("ok" in genResult && genResult.ok === false ? genResult.error : "Generator failed");
          continue;
        }
        const genText = ("text" in genResult ? genResult.text : "").trim();
        if (!genText) {
          lastError = new Error("Generator returned empty response.");
          continue;
        }
        if (verbose >= 3) {
          console.error("--- Generator raw response ---");
          console.error(genText);
          console.error("---");
        }
        const stripped = extractYamlFromMarkdown(genText);
        if (verbose >= 3) {
          console.error("--- After extractYamlFromMarkdown ---");
          console.error(stripped);
          console.error("---");
        }
        if (verbose >= 2) {
          console.error(`[build] Generator response length: ${genText.length} chars, after strip: ${stripped.length} chars`);
        }
        let parsed: ParsedYaml | undefined;
        if (!looksLikeYamlContent(stripped)) {
          const yamlPath = findMentionedYamlPath(genText);
          if (yamlPath) {
            for (const tryPath of [yamlPath, yamlPath.includes("/") ? basename(yamlPath) : null].filter(Boolean) as string[]) {
              try {
                const fromFile = loadYaml(tryPath);
                const fromFileGen = extractGenerated(fromFile);
                if (
                  Object.keys(fromFileGen.capabilities).length > 0 ||
                  Object.keys(fromFileGen.agents).length > 0 ||
                  Object.keys(fromFileGen.workflows).length > 0
                ) {
                  parsed = fromFile;
                  if (verbose >= 1) console.error(`[build] Using YAML from mentioned file: ${tryPath}`);
                  break;
                }
              } catch {
                /* try next path or fall through to parse stripped */
              }
            }
          }
        }
        if (parsed === undefined) {
          try {
            parsed = parseYamlString(stripped);
          } catch (e) {
            const parseErr = e instanceof Error ? e : new Error(String(e));
            lastError = !looksLikeYamlContent(stripped)
              ? new Error(
                  "Generator did not return valid YAML in the response (it may have written to a file or returned only a summary). The generator must output the full YAML in the response, e.g. inside a ```yaml code block. Original parse error: " +
                    parseErr.message
                )
              : parseErr;
            if (verbose >= 2) console.error("[build] YAML parse error:", parseErr.message);
            continue;
          }
        }
        const generated = extractGenerated(parsed);
        if (
          Object.keys(generated.capabilities).length === 0 &&
          Object.keys(generated.agents).length === 0 &&
          Object.keys(generated.workflows).length === 0
        ) {
          lastError = new Error("Generator returned no capabilities, agents, or workflows.");
          continue;
        }
        const simSpinner = ora("Checking similarity…").start();
        if (verbose >= 1) console.error("[build] Checking similarity...");
        try {
          const duplicates = await runSimilarityCheck(providerId, config, generated);
          simSpinner.succeed("Similarity check done.");
          if (verbose >= 1) console.error("[build] Similarity check done.");
          if (duplicates.length > 0) {
            const msg = duplicates
              .map((d) => d.type + ": " + d.id1 + " vs " + d.id2 + (d.reason ? " (" + d.reason + ")" : ""))
              .join("; ");
            lastError = new Error("Similarity check found duplicate or near-duplicate definitions. Consolidate and retry: " + msg);
            continue;
          }
        } catch (e) {
          simSpinner.fail("Similarity check failed.");
          lastError = e instanceof Error ? e : new Error(String(e));
          continue;
        }
        const mergeSpinner = ora("Merging…").start();
        if (verbose >= 1) console.error("[build] Merging...");
        const merged = mergeIntoConfig(config, generated);
        try {
          validate(merged as unknown as ParsedYaml);
        } catch (e) {
          mergeSpinner.fail("Validation failed.");
          lastError = e instanceof Error ? e : new Error(String(e));
          continue;
        }
        try {
          writeOrgFile(orgFilePath, merged);
        } catch (e) {
          mergeSpinner.fail("Write failed.");
          lastError = e instanceof Error ? e : new Error(String(e));
          continue;
        }
        const addedCount =
          Object.keys(generated.capabilities).length +
          Object.keys(generated.agents).length +
          Object.keys(generated.workflows).length;
        const summary =
          `Capabilities: ${Object.keys(generated.capabilities).join(", ") || "none"}. ` +
          `Agents: ${Object.keys(generated.agents).join(", ") || "none"}. ` +
          `Workflows: ${Object.keys(generated.workflows).join(", ") || "none"}.`;
        mergeSpinner.succeed(`Merge done. Added ${addedCount} definition(s).`);
        if (verbose >= 1) console.error(`[build] Merge done. ${summary}`);
        if (!noCodegen) {
          const codegenResult = bundle
            ? await runCodegenPhaseForBundle(providerId, orgFilePath, Object.keys(generated.capabilities), verbose)
            : await runCodegenPhase(providerId, orgFilePath, Object.keys(generated.capabilities), codegenDir, verbose);
          didCodegen = codegenResult.didCodegen;
        }
        const verSpinner = ora("Verifying…").start();
        if (verbose >= 1) console.error("[build] Running verifier...");
        const verifierResult = await service.complete(promptVerifier(prd, summary), { max_tokens: 50 });
        const verifierText = (verifierResult && "text" in verifierResult ? verifierResult.text : "").trim().toUpperCase();
        if (verifierText.includes("PASS")) {
          verSpinner.succeed("Verifier pass.");
          if (verbose >= 1) console.error("[build] Verifier pass.");
          if (didCodegen) console.log("Run `npm run build` to compile and include the new capabilities.");
          return { success: true, addedCount };
        }
        verSpinner.fail("Verifier fail.");
        if (verbose >= 1) console.error("[build] Verifier fail.");
        lastError = new Error(`Verifier failed (attempt ${attempt + 1}/${MAX_VERIFIER_RETRIES}).`);
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  return {
    success: false,
    error: lastError ?? new Error("Verifier failed after max retries."),
  };
}
