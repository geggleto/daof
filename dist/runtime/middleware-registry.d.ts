import type { AgentMiddleware, CapabilityMiddleware, RuntimeWithMiddleware } from "./middleware.js";
export type AgentMiddlewareFactory = (runtime: RuntimeWithMiddleware) => AgentMiddleware;
export type CapabilityMiddlewareFactory = (runtime: RuntimeWithMiddleware) => CapabilityMiddleware;
export declare function registerAgentMiddleware(name: string, factory: AgentMiddlewareFactory): void;
export declare function registerCapabilityMiddleware(name: string, factory: CapabilityMiddlewareFactory): void;
export declare function getKnownAgentMiddlewareNames(): string[];
export declare function getKnownCapabilityMiddlewareNames(): string[];
/**
 * Resolve agent middleware names to middleware instances. Unknown names throw.
 */
export declare function resolveAgentMiddlewares(names: string[], runtime: RuntimeWithMiddleware): AgentMiddleware[];
/**
 * Resolve capability middleware names to middleware instances. Unknown names throw.
 */
export declare function resolveCapabilityMiddlewares(names: string[], runtime: RuntimeWithMiddleware): CapabilityMiddleware[];
//# sourceMappingURL=middleware-registry.d.ts.map