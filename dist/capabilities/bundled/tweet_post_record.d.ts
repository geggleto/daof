import type { CapabilityInstance } from "../../types/json.js";
import type { CapabilityDefinition } from "../../schema/index.js";
/**
 * Bundled TweetPostRecord capability. Input: { post_id, dry_run? }. Output: { url, post_id, dry_run }.
 * When post_id is "stub"/"dry-run" or dry_run is true, url is the stub (DAOF intro tweet); otherwise url = https://x.com/i/status/{post_id}.
 */
export declare function createTweetPostRecordInstance(_capabilityId: string, _def: CapabilityDefinition): CapabilityInstance;
//# sourceMappingURL=tweet_post_record.d.ts.map