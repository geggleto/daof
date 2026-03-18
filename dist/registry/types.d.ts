import type { JsonValue } from "../types/json.js";
/** Metadata stored for search (tags, category, intent). */
export interface RegistryMetadata {
    tags?: string[];
    category?: string;
    intent?: string;
}
/** Stored capability registry entry. */
export interface RegistryCapabilityEntry {
    _id: string;
    type: "capability";
    definition: Record<string, JsonValue>;
    tags: string[];
    category?: string;
    intent?: string;
    source?: "org" | "archive";
    org_path?: string;
    updated_at: string;
    /** ISO timestamp; updated when the entry is fetched (getCapability). Used for staleness. */
    last_accessed?: string;
    /** ISO timestamp; set when pruned by Curator. Excluded from active list/query. */
    archived_at?: string;
}
/** Stored agent registry entry. */
export interface RegistryAgentEntry {
    _id: string;
    type: "agent";
    definition: Record<string, JsonValue>;
    tags: string[];
    role_category?: string;
    source?: "org" | "archive";
    org_path?: string;
    updated_at: string;
    /** ISO timestamp; updated when the entry is fetched (getAgent). Used for staleness. */
    last_accessed?: string;
    /** ISO timestamp; set when pruned by Curator. Excluded from active list/query. */
    archived_at?: string;
}
export type RegistryEntry = RegistryCapabilityEntry | RegistryAgentEntry;
//# sourceMappingURL=types.d.ts.map