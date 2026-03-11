import { registerProviderServiceFactory } from "./registry.js";
import { createCursorProviderService } from "./cursor-service.js";

/**
 * Registers all provider service factories. Import this module at app entry (CLI or programmatic)
 * so getProviderService can resolve providers.
 */
registerProviderServiceFactory("cursor", createCursorProviderService);
