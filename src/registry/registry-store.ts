/**
 * MongoDB-backed registry for skills/capabilities (and optionally agents) with metadata search.
 * Config: REGISTRY_MONGO_URI or MONGO_URI; default mongodb://localhost:27017, database daof_registry.
 */
import { MongoClient, type Db, type Collection } from "mongodb";
import type { JsonValue } from "../types/json.js";
import type {
  RegistryMetadata,
  RegistryCapabilityEntry,
  RegistryAgentEntry,
} from "./types.js";

const DEFAULT_DB = "daof_registry";
const CAPABILITIES_COLLECTION = "capabilities";
const AGENTS_COLLECTION = "agents";

/** Filter for active (non-archived) entries. */
const ACTIVE_FILTER = { $or: [{ archived_at: { $exists: false } }, { archived_at: null }] } as const;

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

  return {
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
      const baseFilter = ACTIVE_FILTER;
      if (!tags.length) {
        const [capIds, agIds] = await Promise.all([
          capabilitiesColl.find(baseFilter).project({ _id: 1 }).toArray(),
          agentsColl.find(baseFilter).project({ _id: 1 }).toArray(),
        ]);
        return {
          capability_ids: capIds.map((d) => String((d as { _id: string })._id)),
          agent_ids: agIds.map((d) => String((d as { _id: string })._id)),
        };
      }
      const tagFilter = options?.matchAll
        ? { ...baseFilter, tags: { $all: tags } }
        : { ...baseFilter, tags: { $in: tags } };
      const [capIds, agIds] = await Promise.all([
        capabilitiesColl.find(tagFilter).project({ _id: 1 }).toArray(),
        agentsColl.find(tagFilter).project({ _id: 1 }).toArray(),
      ]);
      return {
        capability_ids: capIds.map((d) => String((d as { _id: string })._id)),
        agent_ids: agIds.map((d) => String((d as { _id: string })._id)),
      };
    },

    async queryByCategory(category) {
      const baseFilter = ACTIVE_FILTER;
      const [capIds, agIds] = await Promise.all([
        capabilitiesColl.find({ ...baseFilter, category }).project({ _id: 1 }).toArray(),
        agentsColl.find({ ...baseFilter, role_category: category }).project({ _id: 1 }).toArray(),
      ]);
      return {
        capability_ids: capIds.map((d) => String((d as { _id: string })._id)),
        agent_ids: agIds.map((d) => String((d as { _id: string })._id)),
      };
    },

    async getCapability(id) {
      const filter = { _id: id, ...ACTIVE_FILTER };
      const doc = await capabilitiesColl.findOne(filter);
      if (!doc) return null;
      const now = new Date().toISOString();
      await capabilitiesColl.updateOne({ _id: id }, { $set: { last_accessed: now } });
      return { ...doc, last_accessed: now };
    },

    async getAgent(id) {
      const filter = { _id: id, ...ACTIVE_FILTER };
      const doc = await agentsColl.findOne(filter);
      if (!doc) return null;
      const now = new Date().toISOString();
      await agentsColl.updateOne({ _id: id }, { $set: { last_accessed: now } });
      return { ...doc, last_accessed: now };
    },

    async listAll() {
      const [capIds, agIds] = await Promise.all([
        capabilitiesColl.find(ACTIVE_FILTER).project({ _id: 1 }).toArray(),
        agentsColl.find(ACTIVE_FILTER).project({ _id: 1 }).toArray(),
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
      const capFilter = includeArchived ? staleFilter : { $and: [ACTIVE_FILTER, staleFilter] };
      const agFilter = includeArchived ? staleFilter : { $and: [ACTIVE_FILTER, staleFilter] };
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
      const stale = await this.listStale({ olderThanDays, includeArchived: false });
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
