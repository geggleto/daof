export interface UrlAllowOptions {
    /** If true, allow http: in addition to https:. Default false. */
    allowHttp?: boolean;
    /** If set, host must be in this list (case-insensitive). Overrides private-IP block when host is allowlisted. */
    allowedHosts?: string[];
}
/**
 * Returns true if the URL is allowed for outbound requests (e.g. webhook).
 * By default only https: is allowed; private/IP and link-local hosts are blocked.
 */
export declare function isUrlAllowed(url: string, options?: UrlAllowOptions): boolean;
//# sourceMappingURL=url-safety.d.ts.map