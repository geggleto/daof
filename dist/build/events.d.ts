import type { OrgConfig } from "../schema/index.js";
export declare const BUILD_REPLY_TIMEOUT_MS = 120000;
export declare function getEventsQueueName(config: OrgConfig): string;
export declare function randomRequestId(): string;
export interface RunBuildViaEventsResult {
    success: boolean;
    addedCount?: number;
    error?: Error;
}
/**
 * Run build in event mode: connect to backbone, publish build.requested,
 * wait for reply on build.replies (with timeout), return result.
 */
export declare function runBuildViaEvents(description: string, orgFilePath: string, config: OrgConfig, existingCapabilityIds: string[], verbose: number): Promise<RunBuildViaEventsResult>;
//# sourceMappingURL=events.d.ts.map