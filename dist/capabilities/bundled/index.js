import { getBundledCapability as getBundledFromRegistry, getBundledIds, } from "./registry.js";
// Side-effect imports: each module calls registerBundled on load.
import "./logger.js";
import "./event_emitter.js";
import "./webhook_notifier.js";
import "./key_value_store.js";
import "./image_generator.js";
import "./text_generator.js";
import "./sentiment_analyzer.js";
import "./x_poster.js";
import "./metrics_fetcher.js";
import "./file_uploader.js";
import "./tweet_post_record.js";
import "./tweet_metrics_processor.js";
import "./produce_prd.js";
import "./generate_yaml.js";
import "./merge_and_write.js";
import "./verify_build.js";
import "./verify_similarity.js";
import "./build_reply.js";
import "./fetch_agent_performance.js";
import "./apply_capability_upgrade.js";
import "./query_capability_registry.js";
import "./prune_registry.js";
import "./generate_agents_capabilities_and_workflows.js";
/**
 * Return a bundled CapabilityInstance for the given id if one exists; otherwise undefined.
 */
export function getBundledCapability(capabilityId, def) {
    return getBundledFromRegistry(capabilityId, def);
}
/**
 * Set of capability ids that have bundled implementations.
 */
export const BUNDLED_IDS = getBundledIds();
//# sourceMappingURL=index.js.map