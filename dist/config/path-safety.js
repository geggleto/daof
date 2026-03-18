import { existsSync, realpathSync } from "node:fs";
import { resolve, relative } from "node:path";
const SAFE_CAPABILITY_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
/**
 * Resolve a path against a base directory and ensure the result is contained under that base.
 * Uses realpath for the base so symlinks cannot escape. If the resolved path exists, uses realpath
 * for it too; otherwise checks containment of the resolved string. Throws if the path escapes the base.
 *
 * @param filePath - Path (relative or absolute) to resolve
 * @param baseDir - Base directory; resolved path must be under this (after realpath)
 * @returns The resolved, contained absolute path (realpath when it exists, else normalized)
 * @throws If the path escapes baseDir (e.g. ../ outside base)
 */
export function resolvePathUnderBase(filePath, baseDir) {
    const baseReal = realpathSync(baseDir);
    const resolved = resolve(baseDir, filePath);
    const toCheck = existsSync(resolved) ? realpathSync(resolved) : resolve(baseReal, relative(baseDir, resolved));
    const rel = relative(baseReal, toCheck);
    if (rel.startsWith("..")) {
        throw new Error(`Path escapes allowed base: ${filePath} (resolved: ${resolved}, base: ${baseReal})`);
    }
    return toCheck;
}
/**
 * Sanitize a capability id for use in file paths. Only allows [a-zA-Z0-9_-].
 * Throws if the id contains path segments or disallowed characters.
 *
 * @param id - Capability id from config or generator
 * @returns The same id if valid
 * @throws If id is empty or contains . / \ or other disallowed chars
 */
export function sanitizeCapabilityIdForPath(id) {
    if (typeof id !== "string" || id.length === 0) {
        throw new Error("Capability id must be a non-empty string");
    }
    if (!SAFE_CAPABILITY_ID_REGEX.test(id)) {
        throw new Error(`Capability id contains disallowed characters (use only [a-zA-Z0-9_-]): ${id}`);
    }
    return id;
}
//# sourceMappingURL=path-safety.js.map