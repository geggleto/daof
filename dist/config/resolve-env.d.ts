import type { OrgConfig } from "../schema/index.js";
/**
 * Return a copy of the org config with all env(VAR_NAME) string values replaced by process.env[VAR_NAME].
 * Same shape as OrgConfig; no mutation of input.
 */
export declare function resolveEnv(config: OrgConfig): OrgConfig;
//# sourceMappingURL=resolve-env.d.ts.map