const BLOCKED_IPV4_PREFIXES = [
    "127.", // loopback
    "10.", // private
    "169.254.", // link-local
    "172.16.", "172.17.", "172.18.", "172.19.", "172.20.", "172.21.", "172.22.", "172.23.", "172.24.", "172.25.", "172.26.", "172.27.", "172.28.", "172.29.", "172.30.", "172.31.",
];
const BLOCKED_IPV6 = ["::1", "fe80:"]; // loopback, link-local
function isBlockedHost(hostname) {
    const host = hostname.toLowerCase().trim();
    if (host === "localhost")
        return true;
    for (const p of BLOCKED_IPV4_PREFIXES) {
        if (host.startsWith(p))
            return true;
    }
    for (const p of BLOCKED_IPV6) {
        if (host === p || host.startsWith(p))
            return true;
    }
    if (/^\[?::1\]?$/i.test(host))
        return true;
    if (/^fe80:/i.test(host))
        return true;
    return false;
}
/**
 * Returns true if the URL is allowed for outbound requests (e.g. webhook).
 * By default only https: is allowed; private/IP and link-local hosts are blocked.
 */
export function isUrlAllowed(url, options) {
    if (typeof url !== "string" || url.trim() === "")
        return false;
    let parsed;
    try {
        parsed = new URL(url.trim());
    }
    catch {
        return false;
    }
    const scheme = parsed.protocol.toLowerCase();
    if (scheme !== "https:") {
        if (scheme === "http:" && options?.allowHttp) {
            // allow
        }
        else {
            return false;
        }
    }
    const host = parsed.hostname;
    if (options?.allowedHosts && options.allowedHosts.length > 0) {
        const allowed = options.allowedHosts.map((h) => h.toLowerCase().trim());
        if (allowed.includes(host.toLowerCase()))
            return true;
    }
    if (isBlockedHost(host))
        return false;
    return true;
}
//# sourceMappingURL=url-safety.js.map