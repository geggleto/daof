import type { CapabilityInstance } from "../../types/json.js";
import type { CapabilityDefinition } from "../../schema/index.js";
/**
 * Bundled MetricsFetcher capability. Input: { post_id?, ... }. Output: { views?, likes?, ... } or error.
 * When config.endpoint is set, GET to fetch metrics (auth via config.auth or config.api_key); otherwise returns stub { views: 0, likes: 0 }.
 */
export declare function createMetricsFetcherInstance(_capabilityId: string, def: CapabilityDefinition): CapabilityInstance;
//# sourceMappingURL=metrics_fetcher.d.ts.map