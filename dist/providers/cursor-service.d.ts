import type { LLMProviderService } from "./llm-provider-service.js";
/**
 * Cursor provider execution: runs the Cursor headless CLI with the given API key.
 * Owns all Cursor-specific logic (binary name, spawn, env).
 */
export declare function createCursorProviderService(apiKey: string): LLMProviderService;
//# sourceMappingURL=cursor-service.d.ts.map