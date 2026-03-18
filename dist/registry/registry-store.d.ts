import type { JsonValue } from "../types/json.js";
import type { RegistryMetadata, RegistryCapabilityEntry, RegistryAgentEntry } from "./types.js";
export interface ListStaleOptions {
    olderThanDays: number;
    includeArchived?: boolean;
}
export interface ArchiveStaleResult {
    archived_capability_ids: string[];
    archived_agent_ids: string[];
}
export interface RegistryStore {
    upsertCapability(id: string, definition: Record<string, JsonValue>, metadata: RegistryMetadata, options?: {
        source?: "org" | "archive";
        org_path?: string;
    }): Promise<void>;
    upsertAgent(id: string, definition: Record<string, JsonValue>, metadata: RegistryMetadata & {
        role_category?: string;
    }, options?: {
        source?: "org" | "archive";
        org_path?: string;
    }): Promise<void>;
    queryByTags(tags: string[], options?: {
        matchAll?: boolean;
    }): Promise<{
        capability_ids: string[];
        agent_ids: string[];
    }>;
    queryByCategory(category: string): Promise<{
        capability_ids: string[];
        agent_ids: string[];
    }>;
    getCapability(id: string): Promise<RegistryCapabilityEntry | null>;
    getAgent(id: string): Promise<RegistryAgentEntry | null>;
    listAll(): Promise<{
        capability_ids: string[];
        agent_ids: string[];
    }>;
    listStale(options: ListStaleOptions): Promise<{
        capability_ids: string[];
        agent_ids: string[];
    }>;
    archiveStale(options: {
        olderThanDays: number;
    }): Promise<ArchiveStaleResult>;
}
export declare function createRegistryStore(mongoUri: string): Promise<RegistryStore>;
/**
 * Resolve registry MongoDB URI from env or config.
 * Env: REGISTRY_MONGO_URI or MONGO_URI. Default: mongodb://localhost:27017
 */
export declare function getRegistryMongoUri(orgRegistryUri?: string): string;
//# sourceMappingURL=registry-store.d.ts.map