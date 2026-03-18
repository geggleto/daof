import { registerBundled } from "./registry.js";
/** Stub URL used when post_id is stub/dry-run (DAOF intro tweet). */
const STUB_URL = "https://x.com/geggleto/status/2031537230687224302";
function isStubOrDryRun(postId, dryRun) {
    if (dryRun)
        return true;
    const p = postId?.toLowerCase?.() ?? "";
    return p === "stub" || p === "dry-run";
}
/**
 * Bundled TweetPostRecord capability. Input: { post_id, dry_run? }. Output: { url, post_id, dry_run }.
 * When post_id is "stub"/"dry-run" or dry_run is true, url is the stub (DAOF intro tweet); otherwise url = https://x.com/i/status/{post_id}.
 */
export function createTweetPostRecordInstance(_capabilityId, _def) {
    return {
        async execute(input, _runContext) {
            const postId = typeof input.post_id === "string" ? input.post_id : "";
            const dryRun = input.dry_run === true || input.dry_run === "true" || input.dry_run === "1";
            const url = isStubOrDryRun(postId, dryRun)
                ? STUB_URL
                : `https://x.com/i/status/${postId}`;
            return { url, post_id: postId || "stub", dry_run: dryRun };
        },
    };
}
registerBundled("tweet_post_record", createTweetPostRecordInstance);
//# sourceMappingURL=tweet_post_record.js.map