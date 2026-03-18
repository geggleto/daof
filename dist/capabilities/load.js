import { pathToFileURL } from "node:url";
import { resolvePathUnderBase } from "../config/path-safety.js";
import { getDefaultCapabilityResolvers } from "./default-resolvers.js";
/**
 * Load a capability instance from a source file (dynamic import). Path is resolved under allowedSourceRoot (or cwd).
 * If source ends with .ts, tries the .js path first (compiled output) then .ts (for tsx).
 */
async function loadCapabilityFromSource(id, def, allowedSourceRoot) {
    const source = def.source.trim();
    const safeResolved = resolvePathUnderBase(source, allowedSourceRoot);
    const toTry = source.endsWith(".ts")
        ? [safeResolved.replace(/\.ts$/, ".js"), safeResolved]
        : [safeResolved];
    let lastErr;
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
            return instance;
        }
        catch (e) {
            lastErr = e instanceof Error ? e : new Error(String(e));
        }
    }
    throw new Error(`Capability "${id}" source "${source}" could not be loaded: ${lastErr?.message ?? "unknown error"}. Run \`npm run build\` to compile generated capabilities.`);
}
/**
 * Build a map of capability id -> CapabilityInstance from resolved org config.
 * Uses the given resolvers in order; first resolver that returns an instance wins.
 * When resolvers is omitted, uses default (source when set, then bundled, skill, inline-tool).
 * Capabilities with source are loaded via dynamic import; path must be under allowedSourceRoot or cwd.
 */
export async function loadCapabilities(config, options) {
    const opts = options && Array.isArray(options) ? { resolvers: options } : options ?? {};
    const list = opts.resolvers ?? getDefaultCapabilityResolvers();
    const allowedRoot = opts.allowedSourceRoot ?? process.cwd();
    const map = new Map();
    for (const [id, def] of Object.entries(config.capabilities)) {
        if (def.source) {
            const instance = await loadCapabilityFromSource(id, def, allowedRoot);
            map.set(id, instance);
            continue;
        }
        let instance;
        for (const resolve of list) {
            instance = resolve(id, def);
            if (instance)
                break;
        }
        if (!instance) {
            throw new Error(`No resolver could create capability "${id}".`);
        }
        map.set(id, instance);
    }
    return map;
}
//# sourceMappingURL=load.js.map