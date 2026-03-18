import type { BackboneConfig } from "../schema/index.js";
import type { BackboneAdapter } from "./types.js";
export type BackboneFactory = (config: BackboneConfig) => BackboneAdapter;
/**
 * Register a backbone adapter factory for a given type. New backbones (e.g. RabbitMQ, Kafka)
 * can be added by creating an adapter and calling this from their module; no need to edit
 * the factory. Built-in backbones are registered in register-backbones.js.
 */
export declare function registerBackboneFactory(type: string, factory: BackboneFactory): void;
/**
 * Create a backbone adapter from config. Use this to swap backbones
 * (Redis, RabbitMQ, Kafka) by changing config.backbone.type.
 * Adapters must be registered via registerBackboneFactory (e.g. by importing register-backbones).
 */
export declare function createBackbone(config: BackboneConfig): BackboneAdapter;
//# sourceMappingURL=factory.d.ts.map