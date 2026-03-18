import { registerBackboneFactory } from "./factory.js";
import { createRedisAdapter } from "./redis-adapter.js";
/** Register built-in backbone adapters. Import this once (e.g. from index) so createBackbone can resolve "redis". */
registerBackboneFactory("redis", createRedisAdapter);
//# sourceMappingURL=register-backbones.js.map