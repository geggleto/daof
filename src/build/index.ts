/**
 * Build flow: Planner (PRD) → review (unless --yolo) → Generator → merge → validate → write → Verifier.
 * On Verifier fail, retry up to 5 times then exit with error.
 * Uses org-level planner/generator/builder/verifier agents when present; otherwise falls back to direct LLM.
 * If the org file does not exist, a minimal scaffold is created and written before the build runs.
 */
import * as readline from "node:readline";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, basename } from "node:path";
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
import { promptPlanner, promptPlannerRevise, promptGenerator, promptVerifier } from "./prompts.js";
import {
  extractYamlFromMarkdown,
  looksLikeYamlContent,
  findMentionedYamlPath,
  extractGenerated,
  mergeIntoConfig,
} from "./merge.js";
import { bootstrap } from "../runtime/bootstrap.js";
import type { OrgRuntime } from "../runtime/bootstrap.js";
import { createScaffoldOrgConfig, isENOENT } from "./scaffold.js";
import { runSimilarityCheck, runRegistryDuplicateCheck } from "./similarity.js";
import { runBuildViaEvents } from "./events.js";
import {
  runPlannerAgent,
  runGeneratorAgent,
  runMergeAndWriteAgent,
  runVerifierAgent,
} from "./agents.js";
import { runCodegenPhase, runCodegenPhaseForBundle } from "./codegen.js";

const MAX_VERIFIER_RETRIES = 5;
const DEFAULT_CODEGEN_DIR = "generated/capabilities";
const BUILD_AGENT_IDS = ["planner", "generator", "builder", "verifier"] as const;

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
export async function runPlanner(description: string, options: RunPlannerOptions): Promise<string> {
  const { runtime, providerId, verbose = 0 } = options;
  const useAgents = hasBuildAgents(runtime);
  if (useAgents) {
    return runPlannerAgent(runtime, description);
  }
  const service = getProviderService(providerId, getProviderApiKey(providerId));
  if (!service) {
    throw new Error(
      `Planner requires a provider (e.g. ${providerId}) with API key. Set ${providerId === "cursor" ? "CURSOR_API_KEY" : "provider API key"} in the environment.`
    );
  }
  const plannerResult = await service.complete(promptPlanner(description), {
    max_tokens: 1500,
    model: "auto",
  });
  if (!plannerResult || ("ok" in plannerResult && plannerResult.ok === false)) {
    throw new Error(
      "ok" in plannerResult && plannerResult.ok === false ? (plannerResult as { error?: string }).error : "Planner failed"
    );
  }
  const prd = ("text" in plannerResult ? plannerResult.text : "").trim();
  if (!prd) throw new Error("Planner returned empty PRD.");
  if (verbose >= 1) console.error("[build] Planner done.");
  return prd;
}

/**
 * Revise an existing PRD from user feedback (direct LLM only). Returns updated PRD or throws.
 * Used by daof plan interactive loop.
 */
export async function runPlannerRevise(
  prd: string,
  userFeedback: string,
  options: { providerId: string; verbose?: number }
): Promise<string> {
  const { providerId, verbose = 0 } = options;
  const service = getProviderService(providerId, getProviderApiKey(providerId));
  if (!service) {
    throw new Error(
      `Planner revise requires a provider (e.g. ${providerId}) with API key. Set ${providerId === "cursor" ? "CURSOR_API_KEY" : "provider API key"} in the environment.`
    );
  }
  const result = await service.complete(promptPlannerRevise(prd, userFeedback), {
    max_tokens: 1500,
    model: "auto",
  });
  if (!result || ("ok" in result && result.ok === false)) {
    throw new Error(
      "ok" in result && result.ok === false ? (result as { error?: string }).error : "Planner revise failed"
    );
  }
  const revised = ("text" in result ? result.text : "").trim();
  if (!revised) throw new Error("Planner returned empty PRD.");
  if (verbose >= 1) console.error("[build] Planner revise done.");
  return revised;
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

  let existingCapabilityIds = Object.keys(config.capabilities);
  const verbose = options.verbose ?? 0;

  if (verbose >= 1) {
    console.error(didScaffold ? `[build] Scaffolded org at ${orgFilePath}.` : `[build] Loaded org from ${orgFilePath}.`);
  }

  // Event mode: publish build.requested and wait for reply on build.replies (no interactive review).
  if (options.viaEvents) {
    if (!config.backbone) {
      return { success: false, error: new Error("--via-events requires backbone config in the org manifest.") };
    }
    const result = await runBuildViaEvents(description, orgFilePath, config, existingCapabilityIds, verbose);
    if (result.success && (result.addedCount ?? 0) > 0) {
      console.log(`Added ${result.addedCount} capability/agent/workflow definition(s) to ${orgFilePath}.`);
    }
    return result;
  }

  const runtime = await bootstrap(config);
  if (runtime.registry) {
    const fromReg = await runtime.registry.listAll();
    existingCapabilityIds = [...new Set([...existingCapabilityIds, ...fromReg.capability_ids])];
  }
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

  // 2. Planner: generate PRD (or use initialPrd when provided)
  let prd: string;
  if (options.initialPrd) {
    prd = options.initialPrd;
    if (verbose >= 1) console.error("[build] Using provided initial PRD.");
  } else {
    const plannerSpinner = ora("Planning…").start();
    if (verbose >= 1) console.error("[build] Running planner...");
    try {
      prd = await runPlanner(description, { runtime, providerId, verbose });
      plannerSpinner.succeed("Planner done.");
    } catch (err) {
      plannerSpinner.fail("Planner failed.");
      return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
    console.log("--- PRD ---");
    console.log(prd);
    console.log("-----------");
  }

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
          const registryDuplicates = runtime.registry
            ? await runRegistryDuplicateCheck(runtime.registry, generatedForMerge)
            : [];
          const llmDuplicates = await runSimilarityCheck(providerId, config, generatedForMerge);
          const duplicates = [...registryDuplicates];
          for (const d of llmDuplicates) {
            if (!duplicates.some((x) => (x.id1 === d.id1 && x.id2 === d.id2) || (x.id1 === d.id2 && x.id2 === d.id1))) {
              duplicates.push(d);
            }
          }
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
        const genResult = await service.complete(promptGenerator(description, prd, existingCapabilityIds), {
          max_tokens: 4000,
          model: "auto",
        });
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
          const registryDuplicates = runtime.registry
            ? await runRegistryDuplicateCheck(runtime.registry, generated)
            : [];
          const llmDuplicates = await runSimilarityCheck(providerId, config, generated);
          const duplicates = [...registryDuplicates];
          for (const d of llmDuplicates) {
            if (!duplicates.some((x) => (x.id1 === d.id1 && x.id2 === d.id2) || (x.id1 === d.id2 && x.id2 === d.id1))) {
              duplicates.push(d);
            }
          }
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
        const verifierResult = await service.complete(promptVerifier(prd, summary), {
          max_tokens: 50,
          model: "auto",
        });
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
