import type { AgentMiddleware, CapabilityMiddleware, RuntimeWithMiddleware } from "./middleware.js";
import { createAgentMetricsMiddleware } from "./agent-metrics-middleware.js";

export type AgentMiddlewareFactory = (runtime: RuntimeWithMiddleware) => AgentMiddleware;
export type CapabilityMiddlewareFactory = (runtime: RuntimeWithMiddleware) => CapabilityMiddleware;

const agentRegistry = new Map<string, AgentMiddlewareFactory>();
const capabilityRegistry = new Map<string, CapabilityMiddlewareFactory>();

function registerBuiltInAgentMiddlewares(): void {
  if (!agentRegistry.has("agent_metrics")) {
    agentRegistry.set("agent_metrics", createAgentMetricsMiddleware);
  }
}
registerBuiltInAgentMiddlewares();

export function registerAgentMiddleware(name: string, factory: AgentMiddlewareFactory): void {
  agentRegistry.set(name, factory);
}

export function registerCapabilityMiddleware(name: string, factory: CapabilityMiddlewareFactory): void {
  capabilityRegistry.set(name, factory);
}

export function getKnownAgentMiddlewareNames(): string[] {
  return Array.from(agentRegistry.keys());
}

export function getKnownCapabilityMiddlewareNames(): string[] {
  return Array.from(capabilityRegistry.keys());
}

/**
 * Resolve agent middleware names to middleware instances. Unknown names throw.
 */
export function resolveAgentMiddlewares(
  names: string[],
  runtime: RuntimeWithMiddleware
): AgentMiddleware[] {
  const out: AgentMiddleware[] = [];
  for (const name of names) {
    const factory = agentRegistry.get(name);
    if (!factory) {
      throw new Error(
        `Unknown agent middleware: ${name}. Known: ${getKnownAgentMiddlewareNames().join(", ")}.`
      );
    }
    out.push(factory(runtime));
  }
  return out;
}

/**
 * Resolve capability middleware names to middleware instances. Unknown names throw.
 */
export function resolveCapabilityMiddlewares(
  names: string[],
  runtime: RuntimeWithMiddleware
): CapabilityMiddleware[] {
  const out: CapabilityMiddleware[] = [];
  for (const name of names) {
    const factory = capabilityRegistry.get(name);
    if (!factory) {
      throw new Error(
        `Unknown capability middleware: ${name}. Known: ${getKnownCapabilityMiddlewareNames().join(", ")}.`
      );
    }
    out.push(factory(runtime));
  }
  return out;
}
