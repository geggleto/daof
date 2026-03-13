import { z } from "zod";
import { JsonValueSchema, type ParsedYaml } from "../types/json.js";

// ─── Capability definition (top-level map entry) ─────────────────────────────
const CapabilityDefinitionSchema = z.object({
  type: z.enum(["tool", "skill", "hybrid"]),
  description: z.string().optional(),
  config: z.record(z.string(), JsonValueSchema).optional(),
  persistence: z.string().optional(),
  rate_limit: z.string().optional(),
  source: z.string().optional(),
  prompt: z.string().optional(),
  guards: z.array(z.string()).optional(),
  /** Capability ids this capability may call at runtime via runContext.invokeCapability. Must exist in config.capabilities. */
  depends_on: z.array(z.string()).optional(),
  /** Metadata for registry search (optional; may be YAML or skill-generated). */
  tags: z.array(z.string()).optional(),
  category: z.string().optional(),
  intent: z.string().optional(),
});

// ─── Agent (references capabilities by name) ────────────────────────────────
const AgentCapabilityRefSchema = z.object({
  name: z.string().min(1),
});

const AgentSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  role: z.string().min(1),
  description: z.string().optional(),
  capabilities: z.array(AgentCapabilityRefSchema),
  fallback: z.string().optional(),
  max_concurrent_tasks: z.number().optional(),
  /** Metadata for registry search (optional). */
  tags: z.array(z.string()).optional(),
  role_category: z.string().optional(),
});

// ─── Step: sequential or parallel ───────────────────────────────────────────
const SequentialStepSchema = z.object({
  agent: z.string().min(1),
  action: z.string().min(1),
  on_failure: z.string().optional(),
  params: z.record(z.string(), JsonValueSchema).optional(),
  condition: z.string().optional(),
});

const ParallelStepSchema = z.object({
  parallel: z.array(SequentialStepSchema),
});

const StepSchema = z.union([SequentialStepSchema, ParallelStepSchema]);

// ─── Workflow ───────────────────────────────────────────────────────────────
const WorkflowSchema = z.object({
  trigger: z.string().min(1),
  description: z.string().optional(),
  persistence: z.string().optional(),
  steps: z.array(StepSchema),
});

// ─── Scheduler (heartbeat, concurrency) ──────────────────────────────────────
const SchedulerSchema = z
  .object({
    heartbeat_interval_seconds: z.number().min(1).optional(),
    max_concurrent_workflows: z.number().min(1).optional(),
  })
  .optional();

// ─── Backbone ───────────────────────────────────────────────────────────────
const BackboneSchema = z.object({
  type: z.enum(["redis", "rabbitmq", "kafka"]),
  config: z.object({
    url: z.string(),
    queues: z.array(
      z.object({
        name: z.string(),
        type: z.enum(["pubsub", "fifo"]),
      })
    ),
  }),
});

// ─── Middleware (agent and capability pipeline) ───────────────────────────────
const MiddlewareSchema = z
  .object({
    agent: z.array(z.string().min(1)).optional(),
    capability: z.array(z.string().min(1)).optional(),
  })
  .optional();

// ─── Registry (MongoDB for skills/capabilities metadata search) ────────────────
const RegistrySchema = z
  .object({
    mongo_uri: z.string().optional(),
  })
  .optional();

// ─── Fault tolerance ─────────────────────────────────────────────────────────
const FaultToleranceSchema = z
  .object({
    health_checks_interval: z.string().optional(),
    rogue_detection: z
      .array(z.union([z.string(), z.record(z.string(), JsonValueSchema)]))
      .optional(),
    retries: z
      .object({
        default: z.number(),
        backoff: z.string(),
      })
      .optional(),
    circuit_breaker: z
      .object({
        threshold: z.string(),
        reset_after: z.string(),
      })
      .optional(),
    dead_letter_queue: z.boolean().optional(),
    alerts: z
      .object({
        webhook: z.string().optional(),
        channels: z.array(z.string()).optional(),
      })
      .optional(),
  })
  .optional();

// ─── Org (root) ─────────────────────────────────────────────────────────────
const OrgSchema = z.object({
  version: z.string(),
  org: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    goals: z.array(
      z.union([z.string(), z.record(z.string(), JsonValueSchema)])
    ),
  }),
  agents: z.record(AgentSchema),
  capabilities: z.record(CapabilityDefinitionSchema),
  workflows: z.record(WorkflowSchema),
  backbone: BackboneSchema,
  scheduler: SchedulerSchema,
  middleware: MiddlewareSchema,
  fault_tolerance: FaultToleranceSchema,
  registry: RegistrySchema,
});

// ─── Inferred types ─────────────────────────────────────────────────────────
export type CapabilityDefinition = z.infer<typeof CapabilityDefinitionSchema>;
export type AgentConfig = z.infer<typeof AgentSchema>;
export type SequentialStep = z.infer<typeof SequentialStepSchema>;
export type ParallelStep = z.infer<typeof ParallelStepSchema>;
export type WorkflowConfig = z.infer<typeof WorkflowSchema>;
export type SchedulerConfig = z.infer<typeof SchedulerSchema>;
export type BackboneConfig = z.infer<typeof BackboneSchema>;
export type OrgConfig = z.infer<typeof OrgSchema>;

/** Default scheduler values when scheduler section is omitted. */
export const DEFAULT_HEARTBEAT_INTERVAL_SECONDS = 60;
export const DEFAULT_MAX_CONCURRENT_WORKFLOWS = 1;

export function validate(raw: ParsedYaml): OrgConfig {
  return OrgSchema.parse(raw);
}

export { OrgSchema };
