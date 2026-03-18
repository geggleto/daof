import type { CapabilityInstance } from "../../types/json.js";
import type { CapabilityDefinition } from "../../schema/index.js";
/**
 * Bundled TweetMetricsProcessor capability. Input: { post_id, dry_run? }. Output: { skipped: true } when dry_run/stub; otherwise invokes metrics_fetcher and returns its output.
 * Declare depends_on: [metrics_fetcher] in the manifest.
 */
export declare function createTweetMetricsProcessorInstance(_capabilityId: string, _def: CapabilityDefinition): CapabilityInstance;
//# sourceMappingURL=tweet_metrics_processor.d.ts.map