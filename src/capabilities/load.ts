import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { OrgConfig } from "../schema/index.js";
import type { CapabilityDefinition } from "../schema/index.js";
import type { CapabilityInstance } from "../types/json.js";
import { getDefaultCapabilityResolvers, type CapabilityResolver } from "./default-resolvers.js";

export type { CapabilityResolver } from "./default-resolvers.js";

/**
 * Load a capability instance from a source file (dynamic import). Path is resolved relative to process.cwd().
 * If source ends with .ts, tries the .js path first (compiled output) then .ts (for tsx).
 */
async function loadCapabilityFromSource(
  id: string,
  def: CapabilityDefinition
): Promise<CapabilityInstance> {
  const source = def.source!.trim();
  const basePath = join(process.cwd(), source);
  const toTry = source.endsWith(".ts") ? [basePath.replace(/\.ts$/, ".js"), basePath] : [basePath];
  let lastErr: Error | undefined;
  for (const absolutePath of toTry) {
    try {
      const url = pathToFileURL(absolutePath).href;
      const mod = await import(url);
      const factory = mod?.default;
      if (typeof factory !== "function") {
        throw new Error("Module did not export a default function.");
      }
      const instance = factory(id, def);
      if (!instance || typeof instance.execute !== "function") {
        throw new Error("Factory did not return a valid CapabilityInstance.");
      }
      return instance as CapabilityInstance;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw new Error(
    `Capability "${id}" source "${source}" could not be loaded: ${lastErr?.message ?? "unknown error"}. Run \`npm run build\` to compile generated capabilities.`
  );
}

/**
 * Build a map of capability id -> CapabilityInstance from resolved org config.
 * Uses the given resolvers in order; first resolver that returns an instance wins.
 * When resolvers is omitted, uses default (source when set, then bundled, skill, inline-tool).
 * Capabilities with source are loaded via dynamic import from path relative to process.cwd().
 */
export async function loadCapabilities(
  config: OrgConfig,
  resolvers?: CapabilityResolver[]
): Promise<Map<string, CapabilityInstance>> {
  const list = resolvers ?? getDefaultCapabilityResolvers();
  const map = new Map<string, CapabilityInstance>();
  for (const [id, def] of Object.entries(config.capabilities)) {
    if (def.source) {
      const instance = await loadCapabilityFromSource(id, def);
      map.set(id, instance);
      continue;
    }
    let instance: CapabilityInstance | undefined;
    for (const resolve of list) {
      instance = resolve(id, def);
      if (instance) break;
    }
    if (!instance) {
      throw new Error(`No resolver could create capability "${id}".`);
    }
    map.set(id, instance);
  }
  return map;
}
