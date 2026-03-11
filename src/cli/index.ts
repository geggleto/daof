#!/usr/bin/env node
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { ZodError } from "zod";
import { Command } from "commander";
import { loadYaml, validate } from "../parser/index.js";
import { bootstrap, connectBackbone } from "../runtime/bootstrap.js";
import { runWorkflow } from "../workflow/executor.js";
import { createAppCircuitBreaker } from "../fault/circuit-breaker.js";
import { startHeartbeat, onHeartbeatRunDueWorkflows } from "../workflow/scheduler.js";
import { createRedisWorkflowSemaphore, createInMemoryWorkflowSemaphore } from "../backbone/semaphore.js";
import { createRedisRunRegistry } from "../backbone/run-registry.js";
import {
  getPidFilePath,
  checkAlreadyRunning,
  writePidFile,
  removePidFile,
} from "./pidfile.js";
import {
  DEFAULT_HEARTBEAT_INTERVAL_SECONDS,
  DEFAULT_MAX_CONCURRENT_WORKFLOWS,
} from "../schema/index.js";

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
  .option("--pid-file <path>", "PID file path when using -d (default: daof.pid in cwd)");

runCmd.action(async (file: string) => {
  const opts = runCmd.opts() as { workflow?: string; detach?: boolean; pidFile?: string };
  if (opts.detach && opts.workflow) {
    console.error("-d is only valid when running the org without --workflow.");
    process.exit(1);
  }

  try {
    const raw = loadYaml(file);
    const config = validate(raw);
    const runtime = bootstrap(config);

    await connectBackbone(runtime);

    if (opts.workflow) {
      const workflowId = opts.workflow;
      const circuitBreaker = createAppCircuitBreaker({
        failureThreshold: 5,
        timeoutMs: 30_000,
      });
      const result = await runWorkflow(runtime, workflowId, undefined, {
        circuitBreaker,
      });
      if (result.success) {
        console.log(`Workflow '${workflowId}' completed. Success: true.`);
        console.log("Output:");
        console.log(JSON.stringify(result.context, null, 2));
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

    const runOrg = async () => {
      const heartbeatInterval =
        runtime.config.scheduler?.heartbeat_interval_seconds ?? DEFAULT_HEARTBEAT_INTERVAL_SECONDS;
      const maxConcurrent =
        runtime.config.scheduler?.max_concurrent_workflows ?? DEFAULT_MAX_CONCURRENT_WORKFLOWS;

      const hasRedis = runtime.config.backbone.type === "redis";
      const redisUrl = hasRedis ? runtime.config.backbone.config.url : "";
      const semaphore = hasRedis
        ? createRedisWorkflowSemaphore(redisUrl, maxConcurrent)
        : createInMemoryWorkflowSemaphore(maxConcurrent);
      const runRegistry = hasRedis ? createRedisRunRegistry(redisUrl) : null;

      const stopHeartbeat = startHeartbeat(runtime, async (payload) => {
        await onHeartbeatRunDueWorkflows(runtime, payload, semaphore, runRegistry);
      });

      const shutdown = () => {
        stopHeartbeat();
        if (process.env.DAOF_PID_FILE) removePidFile(process.env.DAOF_PID_FILE);
        process.exit(0);
      };
      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);

      console.log(
        `Scheduler running (heartbeat every ${heartbeatInterval}s, max ${maxConcurrent} concurrent workflow(s)). Ctrl+C to stop.`
      );
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

    await runOrg();
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

program
  .command("kill")
  .description("Request cancellation of a workflow run (sets cancel flag in Redis). Requires Redis backbone.")
  .argument("<run_id>", "Run ID of the workflow to cancel")
  .argument("<file>", "Path to the org manifest YAML file (used for Redis config)")
  .action(async (runId: string, file: string) => {
    try {
      const raw = loadYaml(file);
      const config = validate(raw);
      if (config.backbone.type !== "redis") {
        console.error("kill requires Redis backbone.");
        process.exit(1);
      }
      const registry = createRedisRunRegistry(config.backbone.config.url);
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
