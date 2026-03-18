const registry = {};
/**
 * Register a backbone adapter factory for a given type. New backbones (e.g. RabbitMQ, Kafka)
 * can be added by creating an adapter and calling this from their module; no need to edit
 * the factory. Built-in backbones are registered in register-backbones.js.
 */
export function registerBackboneFactory(type, factory) {
    registry[type] = factory;
}
/**
 * Create a backbone adapter from config. Use this to swap backbones
 * (Redis, RabbitMQ, Kafka) by changing config.backbone.type.
 * Adapters must be registered via registerBackboneFactory (e.g. by importing register-backbones).
 */
export function createBackbone(config) {
    const factory = registry[config.type];
    if (!factory) {
        throw new Error(`Unknown backbone type: ${config.type}`);
    }
    return factory(config);
}
//# sourceMappingURL=factory.js.map