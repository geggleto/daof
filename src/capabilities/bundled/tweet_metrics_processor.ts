import type { CapabilityInstance, CapabilityInput, CapabilityOutput } from "../../types/json.js";
import type { CapabilityDefinition } from "../../schema/index.js";
import { registerBundled } from "./registry.js";

function shouldSkip(postId: string, dryRun: boolean): boolean {
  if (dryRun) return true;
  const p = postId?.toLowerCase?.() ?? "";
  return p === "stub" || p === "dry-run" || p === "";
}

/**
 * Bundled TweetMetricsProcessor capability. Input: { post_id, dry_run? }. Output: { skipped: true } when dry_run/stub; otherwise invokes metrics_fetcher and returns its output.
 * Declare depends_on: [metrics_fetcher] in the manifest.
 */
export function createTweetMetricsProcessorInstance(
  _capabilityId: string,
  _def: CapabilityDefinition
): CapabilityInstance {
  return {
    async execute(
      input: CapabilityInput,
      runContext?: import("../../runtime/run-context.js").RunContext
    ): Promise<CapabilityOutput> {
      const postId = typeof input.post_id === "string" ? input.post_id : "";
      const dryRun = input.dry_run === true || input.dry_run === "true" || input.dry_run === "1";

      if (shouldSkip(postId, dryRun)) {
        return { skipped: true };
      }

      const invoke = runContext?.invokeCapability;
      if (!invoke) {
        return { ok: false, error: "invokeCapability not available" };
      }
      return invoke("metrics_fetcher", { post_id: postId });
    },
  };
}
registerBundled("tweet_metrics_processor", createTweetMetricsProcessorInstance);
