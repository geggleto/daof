import type { BackboneAdapter } from "./types.js";
import type { BackboneConfig } from "../schema/index.js";
/**
 * Redis backbone adapter. Uses PUBLISH/SUBSCRIBE for pubsub queues
 * and LPUSH/BRPOP for fifo queues.
 */
export declare function createRedisAdapter(config: BackboneConfig): BackboneAdapter;
//# sourceMappingURL=redis-adapter.d.ts.map