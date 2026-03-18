import type { CapabilityInstance } from "../../types/json.js";
import type { CapabilityDefinition } from "../../schema/index.js";
/**
 * Bundled XPoster capability using Twitter API v2 SDK. Input: { content, media_urls? }. Output: { post_id } or { ok: false, error }.
 * Uses twitter-api-v2; when config has OAuth 1.0a credentials (app_key, app_secret, access_token, access_token_secret, all from env),
 * posts the tweet via client.v2.tweet(content). Otherwise returns stub { post_id: "stub" }.
 * When config.dry_run is true (or env-resolved "true"/"1"), skips the API call and returns { post_id: "dry-run", dry_run: true }.
 */
export declare function createXPosterInstance(_capabilityId: string, def: CapabilityDefinition): CapabilityInstance;
//# sourceMappingURL=x_poster.d.ts.map