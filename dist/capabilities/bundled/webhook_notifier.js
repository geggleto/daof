import { isUrlAllowed } from "../../config/url-safety.js";
import { getAuthHeadersFromCapabilityConfig } from "../auth/registry.js";
import { registerBundled } from "./registry.js";
function getUrlAllowOptions(def) {
    const c = def.config;
    if (!c || typeof c !== "object")
        return {};
    const allowHttp = "allow_http" in c && c.allow_http === true;
    const allowedHosts = "allowed_hosts" in c && Array.isArray(c.allowed_hosts)
        ? (c.allowed_hosts.filter((h) => typeof h === "string"))
        : undefined;
    return { allowHttp, allowedHosts };
}
/**
 * Bundled WebhookNotifier capability. Input: { url, message }. Output: { ok: true } or { ok: false, error }.
 * Only HTTPS URLs are allowed by default (or HTTP if config.allow_http); private/IP and link-local hosts are blocked. Optional config.allowed_hosts allowlist.
 */
export function createWebhookNotifierInstance(_capabilityId, def) {
    const urlOptions = getUrlAllowOptions(def);
    return {
        async execute(input, _runContext) {
            const url = typeof input.url === "string" ? input.url : "";
            const message = typeof input.message === "string" ? input.message : String(input.message ?? "");
            if (!url) {
                return { ok: false, error: "Missing url" };
            }
            if (!isUrlAllowed(url, urlOptions)) {
                return { ok: false, error: "URL not allowed (use HTTPS and avoid private/IP or link-local hosts, or set config.allowed_hosts)" };
            }
            const headers = {
                "Content-Type": "application/json",
                ...getAuthHeadersFromCapabilityConfig(def.config),
            };
            try {
                const res = await fetch(url, {
                    method: "POST",
                    headers,
                    body: JSON.stringify({ message }),
                });
                if (!res.ok) {
                    const text = await res.text();
                    return { ok: false, error: text || `HTTP ${res.status}` };
                }
                return { ok: true };
            }
            catch (err) {
                const error = err instanceof Error ? err.message : String(err);
                return { ok: false, error };
            }
        },
    };
}
registerBundled("webhook_notifier", createWebhookNotifierInstance);
//# sourceMappingURL=webhook_notifier.js.map