import type { CapabilityInstance, CapabilityInput, CapabilityOutput } from "../../types/json.js";
import type { CapabilityDefinition } from "../../schema/index.js";
import type { RunContext } from "../../runtime/run-context.js";

const DEFAULT_BUILD_REPLIES_QUEUE = "build.replies";

function getQueueName(def: CapabilityDefinition): string {
  const config = def.config;
  if (
    config &&
    typeof config === "object" &&
    "queue" in config &&
    typeof (config as Record<string, unknown>).queue === "string"
  ) {
    return (config as Record<string, string>).queue;
  }
  return DEFAULT_BUILD_REPLIES_QUEUE;
}

/**
 * Bundled build_reply capability. Input: { request_id, success, prd?, added_count?, error? }.
 * Publishes to backbone queue (default "build.replies") so the build client can correlate and unblock.
 * Output: { ok: true } or { ok: false, error }.
 */
export function createBuildReplyInstance(
  _capabilityId: string,
  def: CapabilityDefinition
): CapabilityInstance {
  const queueName = getQueueName(def);
  return {
    async execute(
      input: CapabilityInput,
      runContext?: RunContext
    ): Promise<CapabilityOutput> {
      const requestId = input.request_id;
      if (requestId === undefined || requestId === null) {
        return { ok: false, error: "Missing request_id" };
      }
      if (!runContext?.backbone) {
        return { ok: false, error: "Build reply requires runContext.backbone" };
      }
      const success = input.success === true;
      const payload = {
        request_id: requestId,
        success,
        prd: input.prd,
        added_count: input.added_count,
        error: input.error,
      };
      try {
        await runContext.backbone.publish(queueName, payload);
        return { ok: true };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        return { ok: false, error };
      }
    },
  };
}
