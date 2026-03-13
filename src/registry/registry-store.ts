/**
 * MongoDB-backed registry for skills/capabilities (and optionally agents) with metadata search.
 * Config: REGISTRY_MONGO_URI or MONGO_URI; default mongodb://localhost:27017, database daof_registry.
 */
import { MongoClient, type Db, type Collection, type Filter } from "mongodb";
import type { JsonValue } from "../types/json.js";
import type {
  RegistryMetadata,
  RegistryCapabilityEntry,
  RegistryAgentEntry,
} from "./types.js";

const DEFAULT_DB = "daof_registry";
const CAPABILITIES_COLLECTION = "capabilities";
const AGENTS_COLLECTION = "agents";

/** Filter for active (non-archived) entries. Typed per collection so driver Filter<T> accepts it. */
const activeFilterBase = { $or: [{ archived_at: { $exists: false } }, { archived_at: null }] };
const ACTIVE_FILTER_CAP: Filter<RegistryCapabilityEntry> = activeFilterBase as Filter<RegistryCapabilityEntry>;
const ACTIVE_FILTER_AGENT: Filter<RegistryAgentEntry> = activeFilterBase as Filter<RegistryAgentEntry>;

export interface ListStaleOptions {
  olderThanDays: number;
  includeArchived?: boolean;
}

export interface ArchiveStaleResult {
  archived_capability_ids: string[];
  archived_agent_ids: string[];
}

export interface RegistryStore {
  upsertCapability(
    id: string,
    definition: Record<string, JsonValue>,
    metadata: RegistryMetadata,
    options?: { source?: "org" | "archive"; org_path?: string }
  ): Promise<void>;
  upsertAgent(
    id: string,
    definition: Record<string, JsonValue>,
    metadata: RegistryMetadata & { role_category?: string },
    options?: { source?: "org" | "archive"; org_path?: string }
  ): Promise<void>;
  queryByTags(tags: string[], options?: { matchAll?: boolean }): Promise<{ capability_ids: string[]; agent_ids: string[] }>;
  queryByCategory(category: string): Promise<{ capability_ids: string[]; agent_ids: string[] }>;
  getCapability(id: string): Promise<RegistryCapabilityEntry | null>;
  getAgent(id: string): Promise<RegistryAgentEntry | null>;
  listAll(): Promise<{ capability_ids: string[]; agent_ids: string[] }>;
  listStale(options: ListStaleOptions): Promise<{ capability_ids: string[]; agent_ids: string[] }>;
  archiveStale(options: { olderThanDays: number }): Promise<ArchiveStaleResult>;
}

function toTags(metadata: RegistryMetadata): string[] {
  return Array.isArray(metadata.tags) ? metadata.tags : [];
}

function toDoc(
  id: string,
  type: "capability" | "agent",
  definition: Record<string, JsonValue>,
  metadata: RegistryMetadata & { role_category?: string },
  options?: { source?: "org" | "archive"; org_path?: string }
): Omit<RegistryCapabilityEntry, "_id"> | Omit<RegistryAgentEntry, "_id"> {
  const tags = toTags(metadata);
  const now = new Date().toISOString();
  const base = {
    type,
    definition,
    tags,
    category: metadata.category,
    intent: metadata.intent,
    source: options?.source,
    org_path: options?.org_path,
    updated_at: now,
  };
  if (type === "agent") {
    return { ...base, role_category: metadata.role_category } as Omit<RegistryAgentEntry, "_id">;
  }
  return base as Omit<RegistryCapabilityEntry, "_id">;
}

export async function createRegistryStore(mongoUri: string): Promise<RegistryStore> {
  const client = new MongoClient(mongoUri);
  await client.connect();
  const db: Db = client.db(DEFAULT_DB);
  const capabilitiesColl: Collection<RegistryCapabilityEntry> = db.collection(CAPABILITIES_COLLECTION);
  const agentsColl: Collection<RegistryAgentEntry> = db.collection(AGENTS_COLLECTION);

  await capabilitiesColl.createIndex({ tags: 1 });
  await capabilitiesColl.createIndex({ category: 1 });
  await capabilitiesColl.createIndex({ intent: 1 });
  await capabilitiesColl.createIndex({ last_accessed: 1 });
  await capabilitiesColl.createIndex({ archived_at: 1 });
  await agentsColl.createIndex({ tags: 1 });
  await agentsColl.createIndex({ role_category: 1 });
  await agentsColl.createIndex({ last_accessed: 1 });
  await agentsColl.createIndex({ archived_at: 1 });

  const store: RegistryStore = {
    async upsertCapability(id, definition, metadata, options) {
      const doc = toDoc(id, "capability", definition, metadata, options) as Omit<RegistryCapabilityEntry, "_id">;
      await capabilitiesColl.updateOne(
        { _id: id },
        { $set: { _id: id, ...doc } },
        { upsert: true }
      );
    },

    async upsertAgent(id, definition, metadata, options) {
      const doc = toDoc(id, "agent", definition, metadata, options) as Omit<RegistryAgentEntry, "_id">;
      await agentsColl.updateOne(
        { _id: id },
        { $set: { _id: id, ...doc } },
        { upsert: true }
      );
    },

    async queryByTags(tags, options) {
      if (!tags.length) {
        const [capIds, agIds] = await Promise.all([
          capabilitiesColl.find(ACTIVE_FILTER_CAP).project({ _id: 1 }).toArray(),
          agentsColl.find(ACTIVE_FILTER_AGENT).project({ _id: 1 }).toArray(),
        ]);
        return {
          capability_ids: capIds.map((d) => String((d as { _id: string })._id)),
          agent_ids: agIds.map((d) => String((d as { _id: string })._id)),
        };
      }
      const capTagFilter: Filter<RegistryCapabilityEntry> = options?.matchAll
        ? { ...ACTIVE_FILTER_CAP, tags: { $all: tags } }
        : { ...ACTIVE_FILTER_CAP, tags: { $in: tags } };
      const agTagFilter: Filter<RegistryAgentEntry> = options?.matchAll
        ? { ...ACTIVE_FILTER_AGENT, tags: { $all: tags } }
        : { ...ACTIVE_FILTER_AGENT, tags: { $in: tags } };
      const [capIds, agIds] = await Promise.all([
        capabilitiesColl.find(capTagFilter).project({ _id: 1 }).toArray(),
        agentsColl.find(agTagFilter).project({ _id: 1 }).toArray(),
      ]);
      return {
        capability_ids: capIds.map((d) => String((d as { _id: string })._id)),
        agent_ids: agIds.map((d) => String((d as { _id: string })._id)),
      };
    },

    async queryByCategory(category) {
      const [capIds, agIds] = await Promise.all([
        capabilitiesColl.find({ ...ACTIVE_FILTER_CAP, category }).project({ _id: 1 }).toArray(),
        agentsColl.find({ ...ACTIVE_FILTER_AGENT, role_category: category }).project({ _id: 1 }).toArray(),
      ]);
      return {
        capability_ids: capIds.map((d) => String((d as { _id: string })._id)),
        agent_ids: agIds.map((d) => String((d as { _id: string })._id)),
      };
    },

    async getCapability(id) {
      const filter: Filter<RegistryCapabilityEntry> = { _id: id, ...ACTIVE_FILTER_CAP };
      const doc = await capabilitiesColl.findOne(filter);
      if (!doc) return null;
      const now = new Date().toISOString();
      await capabilitiesColl.updateOne({ _id: id }, { $set: { last_accessed: now } });
      return { ...doc, last_accessed: now };
    },

    async getAgent(id) {
      const filter: Filter<RegistryAgentEntry> = { _id: id, ...ACTIVE_FILTER_AGENT };
      const doc = await agentsColl.findOne(filter);
      if (!doc) return null;
      const now = new Date().toISOString();
      await agentsColl.updateOne({ _id: id }, { $set: { last_accessed: now } });
      return { ...doc, last_accessed: now };
    },

    async listAll() {
      const [capIds, agIds] = await Promise.all([
        capabilitiesColl.find(ACTIVE_FILTER_CAP).project({ _id: 1 }).toArray(),
        agentsColl.find(ACTIVE_FILTER_AGENT).project({ _id: 1 }).toArray(),
      ]);
      return {
        capability_ids: capIds.map((d) => String((d as { _id: string })._id)),
        agent_ids: agIds.map((d) => String((d as { _id: string })._id)),
      };
    },

    async listStale(options) {
      const { olderThanDays, includeArchived = false } = options;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - olderThanDays);
      const cutoffIso = cutoff.toISOString();
      const staleFilter = {
        $or: [
          { last_accessed: { $lt: cutoffIso } },
          { last_accessed: { $exists: false }, updated_at: { $lt: cutoffIso } },
        ],
      };
      const capFilter: Filter<RegistryCapabilityEntry> = includeArchived ? (staleFilter as Filter<RegistryCapabilityEntry>) : { $and: [ACTIVE_FILTER_CAP, staleFilter] };
      const agFilter: Filter<RegistryAgentEntry> = includeArchived ? (staleFilter as Filter<RegistryAgentEntry>) : { $and: [ACTIVE_FILTER_AGENT, staleFilter] };
      const [capIds, agIds] = await Promise.all([
        capabilitiesColl.find(capFilter).project({ _id: 1 }).toArray(),
        agentsColl.find(agFilter).project({ _id: 1 }).toArray(),
      ]);
      return {
        capability_ids: capIds.map((d) => String((d as { _id: string })._id)),
        agent_ids: agIds.map((d) => String((d as { _id: string })._id)),
      };
    },

    async archiveStale(options) {
      const { olderThanDays } = options;
      const stale = await store.listStale({ olderThanDays, includeArchived: false });
      const now = new Date().toISOString();
      if (stale.capability_ids.length > 0) {
        await capabilitiesColl.updateMany(
          { _id: { $in: stale.capability_ids } },
          { $set: { archived_at: now, source: "archive" } }
        );
      }
      if (stale.agent_ids.length > 0) {
        await agentsColl.updateMany(
          { _id: { $in: stale.agent_ids } },
          { $set: { archived_at: now, source: "archive" } }
        );
      }
      return {
        archived_capability_ids: stale.capability_ids,
        archived_agent_ids: stale.agent_ids,
      };
    },
  };

  return store;
}

/**
 * Resolve registry MongoDB URI from env or config.
 * Env: REGISTRY_MONGO_URI or MONGO_URI. Default: mongodb://localhost:27017
 */
export function getRegistryMongoUri(orgRegistryUri?: string): string {
  if (typeof orgRegistryUri === "string" && orgRegistryUri.trim()) return orgRegistryUri.trim();
  const env = process.env.REGISTRY_MONGO_URI ?? process.env.MONGO_URI;
  if (typeof env === "string" && env.trim()) return env.trim();
  return "mongodb://localhost:27017";
}
