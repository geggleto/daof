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
export declare function resolvePathUnderBase(filePath: string, baseDir: string): string;
/**
 * Sanitize a capability id for use in file paths. Only allows [a-zA-Z0-9_-].
 * Throws if the id contains path segments or disallowed characters.
 *
 * @param id - Capability id from config or generator
 * @returns The same id if valid
 * @throws If id is empty or contains . / \ or other disallowed chars
 */
export declare function sanitizeCapabilityIdForPath(id: string): string;
//# sourceMappingURL=path-safety.d.ts.map