#!/usr/bin/env node
import * as readline from "node:readline";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import "../providers/register-providers.js";
import "../backbone/register-backbones.js";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { ZodError } from "zod";
import { Command } from "commander";
import { loadYaml, validate, writeOrgFile } from "../parser/index.js";
import { createRegistryStore, getRegistryMongoUri } from "../registry/registry-store.js";
import type { RegistryMetadata } from "../registry/types.js";
import { runBuild, runPlanner, runPlannerRevise } from "../build/index.js";
import { createScaffoldOrgConfig, isENOENT } from "../build/scaffold.js";
import { getProviderApiKey, getProviderService } from "../providers/registry.js";
import { bootstrap, connectBackbone } from "../runtime/bootstrap.js";
import { runWorkflow } from "../workflow/executor.js";
import { runScheduler } from "../runtime/run-org.js";
import { createBackbone } from "../backbone/factory.js";
import { createAppCircuitBreaker } from "../fault/circuit-breaker.js";
import {
  getPidFilePath,
  checkAlreadyRunning,
  writePidFile,
  removePidFile,
} from "./pidfile.js";

const program = new Command();

program
  .name("daof")
  .description("Declarative Agentic Orchestration Framework")
  .version("0.1.0");

program
  .command("validate")
  .description("Validate an org manifest YAML file")
  .argument("<file>", "Path to the org manifest YAML file")
  .action((file: string) => {
    try {
      const raw = loadYaml(file);
      const config = validate(raw);
      console.log(`Valid. (org: ${config.org.name})`);
      process.exit(0);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Validation failed:", message);
      if (err instanceof ZodError) {
        for (const issue of err.issues) {
          console.error("  -", JSON.stringify(issue));
        }
      }
      process.exit(1);
    }
  });

const runCmd = program
  .command("run")
  .description("Load, validate, bootstrap, and run one workflow or run the org (scheduler)")
  .argument("<file>", "Path to the org manifest YAML file")
  .option("--workflow <name>", "Workflow to run (one-shot). Omit to run the org (heartbeat + cron workflows).")
  .option("-d, --detach", "Run in background (only when not using --workflow)")
  .option("--pid-file <path>", "PID file path when using -d (default: daof.pid in cwd)")
  .option("-v, --verbose", "Increase verbosity; use -vvv to print workflow output JSON", (v: string, prev: number) => prev + 1, 0);

runCmd.action(async (file: string) => {
  const opts = runCmd.opts() as { workflow?: string; detach?: boolean; pidFile?: string; verbose?: number };
  if (opts.detach && opts.workflow) {
    console.error("-d is only valid when running the org without --workflow.");
    process.exit(1);
  }

  try {
    const raw = loadYaml(file);
    const config = validate(raw);
    const runtime = await bootstrap(config);

    await connectBackbone(runtime);

    if (opts.workflow) {
      const workflowId = opts.workflow;
      const circuitBreaker = createAppCircuitBreaker({
        failureThreshold: 5,
        timeoutMs: 120_000,
      });
      const result = await runWorkflow(runtime, workflowId, undefined, {
        circuitBreaker,
      });
      if (result.success) {
        console.log(`Workflow '${workflowId}' completed. Success: true.`);
        if ((opts.verbose ?? 0) >= 3) {
          console.log("Output:");
          console.log(JSON.stringify(result.context, null, 2));
        }
        process.exit(0);
      } else {
        const msg = result.error?.message ?? "";
        const isCircuitOpen = /circuit is open/i.test(msg);
        if (isCircuitOpen) {
          console.error(
            `Circuit breaker open after too many failures. Exiting gracefully. (${msg})`
          );
        } else {
          console.error(`Workflow '${workflowId}' completed. Success: false.`, msg);
        }
        process.exit(1);
      }
    }

    runtime.orgFilePath = file;

    const onBeforeShutdown = () => {
      if (process.env.DAOF_PID_FILE) removePidFile(process.env.DAOF_PID_FILE);
    };

    if (opts.detach) {
      const pidFilePath = getPidFilePath(opts.pidFile);
      checkAlreadyRunning(pidFilePath);
      writePidFile(pidFilePath);
      const cliPath = fileURLToPath(import.meta.url);
      const child = spawn(process.execPath, [cliPath, "run", file], {
        detached: true,
        stdio: "ignore",
        env: { ...process.env, DAOF_CHILD: "1", DAOF_PID_FILE: pidFilePath },
        cwd: process.cwd(),
      });
      child.unref();
      console.log(`Detached. PID: ${child.pid}. PID file: ${pidFilePath}`);
      process.exit(0);
    }

    if (process.env.DAOF_CHILD === "1") {
      const pidFilePath = process.env.DAOF_PID_FILE;
      if (pidFilePath) {
        process.on("exit", () => removePidFile(pidFilePath));
      }
    }

    await runScheduler(runtime, { onBeforeShutdown });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Run failed:", message);
    if (err instanceof ZodError) {
      for (const issue of err.issues) {
        console.error("  -", JSON.stringify(issue));
      }
    }
    process.exit(1);
  }
});

const buildCmd = program
  .command("build")
  .description("Generate capabilities/workflows/agents from a description (Planner, review, generate, Verifier).")
  .argument("<description>", "Description of what to build")
  .option("--file <path>", "Org manifest to update (default: org.yaml in cwd)", "org.yaml")
  .option("--yolo", "Skip PRD review and proceed immediately")
  .option("--provider <id>", "LLM provider (default: cursor)", "cursor")
  .option("--via-events", "Publish build.requested and wait for reply from running org (requires daof run; no review)")
  .option("--no-codegen", "Disable capability source code generation (codegen is on by default)")
  .option("--codegen-dir <path>", "Directory for generated capability sources (default: generated/capabilities)", "generated/capabilities")
  .option("--bundle", "Add generated capability to framework source (src/capabilities/bundled) and register in index; requires running from repo root")
  .option("-v, --verbose", "Verbosity; use -vv for parse/summary, -vvv for raw LLM output", (v: string, prev: number) => prev + 1, 0);

buildCmd.action(async (description: string) => {
  const opts = buildCmd.opts() as { file?: string; yolo?: boolean; provider?: string; viaEvents?: boolean; verbose?: number; noCodegen?: boolean; codegenDir?: string; bundle?: boolean };
  const orgFilePath = opts.file ?? "org.yaml";
    const result = await runBuild(description, {
      orgFilePath,
      yolo: opts.yolo ?? false,
      providerId: opts.provider ?? "cursor",
      viaEvents: opts.viaEvents ?? false,
      verbose: opts.verbose ?? 0,
      noCodegen: opts.noCodegen ?? false,
      codegenDir: opts.codegenDir ?? "generated/capabilities",
      bundle: opts.bundle ?? false,
    });
    if (result.success) {
      const count = result.addedCount ?? 0;
      if (count > 0) {
        console.log(`Added ${count} capability/agent/workflow definition(s) to ${orgFilePath}.`);
      }
      process.exit(0);
  } else {
    console.error("Build failed:", result.error?.message ?? "Unknown error");
    process.exit(1);
  }
});

function askQuestion(prompt: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve((answer ?? "").trim());
    });
  });
}

const planCmd = program
  .command("plan")
  .description("Interactively develop a PRD with the Planner; optionally execute the full build.")
  .argument("[description]", "What to build (prompted if omitted)")
  .option("--file <path>", "Org manifest path for context and execute (default: org.yaml)", "org.yaml")
  .option("--provider <id>", "LLM provider (default: cursor)", "cursor")
  .option("--no-edit", "One-shot: print PRD and exit (no interactive loop)")
  .option("--execute", "With --no-edit: run full build with the generated PRD")
  .option("-v, --verbose", "Verbosity", (v: string, prev: number) => prev + 1, 0);

planCmd.action(async (descriptionArg: string) => {
  const opts = planCmd.opts() as {
    file?: string;
    provider?: string;
    noEdit?: boolean;
    execute?: boolean;
    verbose?: number;
  };
  const orgFilePath = opts.file ?? "org.yaml";
  const providerId = opts.provider ?? "cursor";
  const noEdit = opts.noEdit ?? false;
  const execute = opts.execute ?? false;
  const verbose = opts.verbose ?? 0;

  let description = (descriptionArg ?? "").trim();
  if (!description) {
    description = await askQuestion("Describe what you want to build: ");
    if (!description) {
      console.error("No description provided. Exiting.");
      process.exit(1);
    }
  }

  let config: Awaited<ReturnType<typeof validate>>;
  try {
    const raw = loadYaml(orgFilePath);
    config = validate(raw);
  } catch (err) {
    if (isENOENT(err)) {
      config = createScaffoldOrgConfig();
      try {
        mkdirSync(dirname(orgFilePath), { recursive: true });
        writeOrgFile(orgFilePath, config);
        console.log(`Created scaffold org at ${orgFilePath}.`);
      } catch (writeErr) {
        console.error("Failed to write scaffold org:", writeErr instanceof Error ? writeErr.message : String(writeErr));
        process.exit(1);
      }
    } else {
      console.error("Validation failed:", err instanceof Error ? err.message : String(err));
      if (err instanceof ZodError) {
        for (const issue of err.issues) {
          console.error("  -", JSON.stringify(issue));
        }
      }
      process.exit(1);
    }
  }

  const runtime = await bootstrap(config);
  const apiKey = getProviderApiKey(providerId);
  const service = getProviderService(providerId, apiKey);
  if (!service) {
    console.error(
      `Planner requires a provider (e.g. ${providerId}) with API key. Set ${providerId === "cursor" ? "CURSOR_API_KEY" : "provider API key"} in the environment.`
    );
    process.exit(1);
  }

  let prd: string;
  try {
    prd = await runPlanner(description, { runtime, providerId, verbose });
  } catch (err) {
    console.error("Planner failed:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  console.log("--- PRD ---");
  console.log(prd);
  console.log("-----------");

  if (noEdit) {
    if (execute) {
      const result = await runBuild(description, {
        orgFilePath,
        yolo: true,
        providerId,
        initialPrd: prd,
        verbose,
      });
      if (result.success) {
        const count = result.addedCount ?? 0;
        if (count > 0) {
          console.log(`Added ${count} capability/agent/workflow definition(s) to ${orgFilePath}.`);
        }
        process.exit(0);
      } else {
        console.error("Build failed:", result.error?.message ?? "Unknown error");
        process.exit(1);
      }
    }
    process.exit(0);
  }

  for (;;) {
    const choice = await askQuestion("[r]evise  [e]xecute build  [s]ave  [q]uit: ");
    const key = (choice ?? "").toLowerCase().trim() || choice;

    if (key === "q" || key === "quit") {
      console.log("Bye.");
      process.exit(0);
    }

    if (key === "r" || key === "revise") {
      const feedback = await askQuestion("Describe changes (e.g. add X, remove Y): ");
      if (!feedback) {
        console.log("No changes entered. Showing PRD again.");
      } else {
        try {
          prd = await runPlannerRevise(prd, feedback, { providerId, verbose });
          console.log("--- PRD ---");
          console.log(prd);
          console.log("-----------");
        } catch (err) {
          console.error("Revise failed:", err instanceof Error ? err.message : String(err));
        }
      }
      continue;
    }

    if (key === "e" || key === "execute") {
      const result = await runBuild(description, {
        orgFilePath,
        yolo: true,
        providerId,
        initialPrd: prd,
        verbose,
      });
      if (result.success) {
        const count = result.addedCount ?? 0;
        if (count > 0) {
          console.log(`Added ${count} capability/agent/workflow definition(s) to ${orgFilePath}.`);
        }
        process.exit(0);
      } else {
        console.error("Build failed:", result.error?.message ?? "Unknown error");
      }
      continue;
    }

    if (key === "s" || key === "save") {
      const pathAnswer = await askQuestion(`Save PRD to path (default: prd.md): `);
      const outPath = (pathAnswer ?? "").trim() || "prd.md";
      try {
        writeFileSync(outPath, prd, "utf8");
        console.log(`Saved to ${outPath}.`);
      } catch (err) {
        console.error("Save failed:", err instanceof Error ? err.message : String(err));
      }
      continue;
    }

    console.log("Unknown option. Choose r, e, s, or q.");
  }
});

const registryCmd = program
  .command("registry")
  .description("Skills/capabilities registry (MongoDB): sync org to registry, or query by metadata.");

registryCmd
  .command("sync")
  .description("Load org manifest and upsert all capabilities (and agents) into the registry with metadata from YAML.")
  .option("--file <path>", "Org manifest path (default: org.yaml)", "org.yaml")
  .action(async function (this: import("commander").Command) {
    const file = (this.opts() as { file?: string }).file ?? "org.yaml";
    try {
      const raw = loadYaml(file);
      const config = validate(raw);
      const uri = getRegistryMongoUri(config.registry?.mongo_uri);
      const store = await createRegistryStore(uri);
      let capCount = 0;
      let agentCount = 0;
      for (const [id, def] of Object.entries(config.capabilities)) {
        if (typeof def !== "object" || def === null) continue;
        const d = def as Record<string, unknown>;
        const definition = { type: d.type, description: d.description, config: d.config } as Record<string, import("../types/json.js").JsonValue>;
        const metadata: RegistryMetadata = {
          tags: Array.isArray(d.tags) ? (d.tags as string[]) : [],
          category: typeof d.category === "string" ? d.category : undefined,
          intent: typeof d.intent === "string" ? d.intent : undefined,
        };
        await store.upsertCapability(id, definition, metadata, { source: "org", org_path: file });
        capCount++;
      }
      for (const [id, def] of Object.entries(config.agents)) {
        if (typeof def !== "object" || def === null) continue;
        const d = def as Record<string, unknown>;
        const definition = { provider: d.provider, model: d.model, role: d.role, description: d.description } as Record<string, import("../types/json.js").JsonValue>;
        const metadata: RegistryMetadata & { role_category?: string } = {
          tags: Array.isArray(d.tags) ? (d.tags as string[]) : [],
          role_category: typeof d.role_category === "string" ? d.role_category : undefined,
        };
        await store.upsertAgent(id, definition, metadata, { source: "org", org_path: file });
        agentCount++;
      }
      console.log(`Synced ${capCount} capabilities and ${agentCount} agents to registry.`);
      process.exit(0);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Registry sync failed:", message);
      process.exit(1);
    }
  });

registryCmd
  .command("query")
  .description("Query registry by tags or category; print matching capability and agent ids.")
  .option("--tags <list>", "Comma-separated tags (e.g. image,http)")
  .option("--category <name>", "Category name")
  .action(async function (this: import("commander").Command) {
    const opts = this.opts() as { tags?: string; category?: string };
    try {
      const uri = getRegistryMongoUri();
      const store = await createRegistryStore(uri);
      if (opts.tags) {
        const tags = opts.tags.split(",").map((t) => t.trim()).filter(Boolean);
        const result = await store.queryByTags(tags, { matchAll: false });
        console.log("capability_ids:", result.capability_ids.join(", ") || "(none)");
        console.log("agent_ids:", result.agent_ids.join(", ") || "(none)");
      } else if (opts.category) {
        const result = await store.queryByCategory(opts.category);
        console.log("capability_ids:", result.capability_ids.join(", ") || "(none)");
        console.log("agent_ids:", result.agent_ids.join(", ") || "(none)");
      } else {
        const result = await store.listAll();
        console.log("capability_ids:", result.capability_ids.join(", ") || "(none)");
        console.log("agent_ids:", result.agent_ids.join(", ") || "(none)");
      }
      process.exit(0);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Registry query failed:", message);
      process.exit(1);
    }
  });

program
  .command("kill")
  .description("Request cancellation of a workflow run (sets cancel flag in Redis). Requires Redis backbone.")
  .argument("<run_id>", "Run ID of the workflow to cancel")
  .argument("<file>", "Path to the org manifest YAML file (used for Redis config)")
  .action(async (runId: string, file: string) => {
    try {
      const raw = loadYaml(file);
      const config = validate(raw);
      const adapter = createBackbone(config.backbone);
      await adapter.connect();
      const registry = adapter.createRunRegistry?.();
      if (!registry) {
        console.error("kill requires a backbone that supports run registry (e.g. Redis).");
        process.exit(1);
      }
      await registry.requestCancel(runId);
      console.log(`Cancel requested for run ${runId}.`);
      process.exit(0);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Kill failed:", message);
      process.exit(1);
    }
  });

program.parse();
