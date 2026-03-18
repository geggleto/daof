import type { CapabilityInstance } from "../../types/json.js";
import type { CapabilityDefinition } from "../../schema/index.js";
/**
 * Bundled WebhookNotifier capability. Input: { url, message }. Output: { ok: true } or { ok: false, error }.
 * Only HTTPS URLs are allowed by default (or HTTP if config.allow_http); private/IP and link-local hosts are blocked. Optional config.allowed_hosts allowlist.
 */
export declare function createWebhookNotifierInstance(_capabilityId: string, def: CapabilityDefinition): CapabilityInstance;
//# sourceMappingURL=webhook_notifier.d.ts.map