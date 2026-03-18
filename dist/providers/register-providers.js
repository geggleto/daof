import { registerProviderDefinition, registerProviderServiceFactory } from "./registry.js";
import { createCursorProviderService } from "./cursor-service.js";
/**
 * Registers all provider definitions and service factories. Import this module at app entry (CLI or programmatic)
 * so getProviderService and getProvider can resolve providers.
 */
registerProviderDefinition("cursor", { id: "cursor", apiKeyEnvVar: "CURSOR_API_KEY" });
registerProviderServiceFactory("cursor", createCursorProviderService);
//# sourceMappingURL=register-providers.js.map