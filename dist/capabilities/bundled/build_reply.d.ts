import type { CapabilityInstance } from "../../types/json.js";
import type { CapabilityDefinition } from "../../schema/index.js";
/**
 * Bundled build_reply capability. Input: { request_id, success, prd?, added_count?, error? }.
 * Publishes to backbone queue (default "build.replies") so the build client can correlate and unblock.
 * Output: { ok: true } or { ok: false, error }.
 */
export declare function createBuildReplyInstance(_capabilityId: string, def: CapabilityDefinition): CapabilityInstance;
//# sourceMappingURL=build_reply.d.ts.map