import { TwitterApi } from "twitter-api-v2";
import type { CapabilityInstance, CapabilityInput, CapabilityOutput } from "../../types/json.js";
import type { CapabilityDefinition } from "../../schema/index.js";
import { registerBundled } from "./registry.js";

function getStr(config: Record<string, unknown> | undefined, key: string): string {
  if (!config || typeof config !== "object") return "";
  const v = config[key];
  return typeof v === "string" ? v : "";
}

function isDryRun(config: Record<string, unknown> | undefined): boolean {
  if (!config || typeof config !== "object") return false;
  const v = config.dry_run;
  if (v === true) return true;
  if (typeof v === "string" && (v === "true" || v === "1")) return true;
  return false;
}

/**
 * Bundled XPoster capability using Twitter API v2 SDK. Input: { content, media_urls? }. Output: { post_id } or { ok: false, error }.
 * Uses twitter-api-v2; when config has OAuth 1.0a credentials (app_key, app_secret, access_token, access_token_secret, all from env),
 * posts the tweet via client.v2.tweet(content). Otherwise returns stub { post_id: "stub" }.
 * When config.dry_run is true (or env-resolved "true"/"1"), skips the API call and returns { post_id: "dry-run", dry_run: true }.
 */
export function createXPosterInstance(
  _capabilityId: string,
  def: CapabilityDefinition
): CapabilityInstance {
  return {
    async execute(
      input: CapabilityInput,
      _runContext?: import("../../runtime/run-context.js").RunContext
    ): Promise<CapabilityOutput> {
      const content = typeof input.content === "string" ? input.content : "";
      if (!content) {
        return { ok: false, error: "Missing content" };
      }

      const config = def.config as Record<string, unknown> | undefined;
      if (isDryRun(config)) {
        return { post_id: "dry-run", dry_run: true };
      }

      const appKey = getStr(config, "app_key");
      const appSecret = getStr(config, "app_secret");
      const accessToken = getStr(config, "access_token");
      const accessSecret = getStr(config, "access_token_secret");

      if (!appKey || !appSecret || !accessToken || !accessSecret) {
        return { post_id: "stub" };
      }

      try {
        const client = new TwitterApi({
          appKey,
          appSecret,
          accessToken,
          accessSecret,
        });
        const result = await client.v2.tweet(content);
        const postId = result.data?.id ?? "stub";
        return { post_id: postId };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        return { ok: false, error };
      }
    },
  };
}
registerBundled("x_poster", createXPosterInstance);
