/**
 * MongoDB-backed registry for skills/capabilities (and optionally agents) with metadata search.
 * Config: REGISTRY_MONGO_URI or MONGO_URI; default mongodb://localhost:27017, database daof_registry.
 */
import { MongoClient } from "mongodb";
const DEFAULT_DB = "daof_registry";
const CAPABILITIES_COLLECTION = "capabilities";
const AGENTS_COLLECTION = "agents";
/** Filter for active (non-archived) entries. Typed per collection so driver Filter<T> accepts it. */
const activeFilterBase = { $or: [{ archived_at: { $exists: false } }, { archived_at: null }] };
const ACTIVE_FILTER_CAP = activeFilterBase;
const ACTIVE_FILTER_AGENT = activeFilterBase;
function toTags(metadata) {
    return Array.isArray(metadata.tags) ? metadata.tags : [];
}
function toDoc(id, type, definition, metadata, options) {
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
        return { ...base, role_category: metadata.role_category };
    }
    return base;
}
export async function createRegistryStore(mongoUri) {
    const client = new MongoClient(mongoUri);
    await client.connect();
    const db = client.db(DEFAULT_DB);
    const capabilitiesColl = db.collection(CAPABILITIES_COLLECTION);
    const agentsColl = db.collection(AGENTS_COLLECTION);
    await capabilitiesColl.createIndex({ tags: 1 });
    await capabilitiesColl.createIndex({ category: 1 });
    await capabilitiesColl.createIndex({ intent: 1 });
    await capabilitiesColl.createIndex({ last_accessed: 1 });
    await capabilitiesColl.createIndex({ archived_at: 1 });
    await agentsColl.createIndex({ tags: 1 });
    await agentsColl.createIndex({ role_category: 1 });
    await agentsColl.createIndex({ last_accessed: 1 });
    await agentsColl.createIndex({ archived_at: 1 });
    const store = {
        async upsertCapability(id, definition, metadata, options) {
            const doc = toDoc(id, "capability", definition, metadata, options);
            await capabilitiesColl.updateOne({ _id: id }, { $set: { _id: id, ...doc } }, { upsert: true });
        },
        async upsertAgent(id, definition, metadata, options) {
            const doc = toDoc(id, "agent", definition, metadata, options);
            await agentsColl.updateOne({ _id: id }, { $set: { _id: id, ...doc } }, { upsert: true });
        },
        async queryByTags(tags, options) {
            if (!tags.length) {
                const [capIds, agIds] = await Promise.all([
                    capabilitiesColl.find(ACTIVE_FILTER_CAP).project({ _id: 1 }).toArray(),
                    agentsColl.find(ACTIVE_FILTER_AGENT).project({ _id: 1 }).toArray(),
                ]);
                return {
                    capability_ids: capIds.map((d) => String(d._id)),
                    agent_ids: agIds.map((d) => String(d._id)),
                };
            }
            const capTagFilter = options?.matchAll
                ? { ...ACTIVE_FILTER_CAP, tags: { $all: tags } }
                : { ...ACTIVE_FILTER_CAP, tags: { $in: tags } };
            const agTagFilter = options?.matchAll
                ? { ...ACTIVE_FILTER_AGENT, tags: { $all: tags } }
                : { ...ACTIVE_FILTER_AGENT, tags: { $in: tags } };
            const [capIds, agIds] = await Promise.all([
                capabilitiesColl.find(capTagFilter).project({ _id: 1 }).toArray(),
                agentsColl.find(agTagFilter).project({ _id: 1 }).toArray(),
            ]);
            return {
                capability_ids: capIds.map((d) => String(d._id)),
                agent_ids: agIds.map((d) => String(d._id)),
            };
        },
        async queryByCategory(category) {
            const [capIds, agIds] = await Promise.all([
                capabilitiesColl.find({ ...ACTIVE_FILTER_CAP, category }).project({ _id: 1 }).toArray(),
                agentsColl.find({ ...ACTIVE_FILTER_AGENT, role_category: category }).project({ _id: 1 }).toArray(),
            ]);
            return {
                capability_ids: capIds.map((d) => String(d._id)),
                agent_ids: agIds.map((d) => String(d._id)),
            };
        },
        async getCapability(id) {
            const filter = { _id: id, ...ACTIVE_FILTER_CAP };
            const doc = await capabilitiesColl.findOne(filter);
            if (!doc)
                return null;
            const now = new Date().toISOString();
            await capabilitiesColl.updateOne({ _id: id }, { $set: { last_accessed: now } });
            return { ...doc, last_accessed: now };
        },
        async getAgent(id) {
            const filter = { _id: id, ...ACTIVE_FILTER_AGENT };
            const doc = await agentsColl.findOne(filter);
            if (!doc)
                return null;
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
                capability_ids: capIds.map((d) => String(d._id)),
                agent_ids: agIds.map((d) => String(d._id)),
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
            const capFilter = includeArchived ? staleFilter : { $and: [ACTIVE_FILTER_CAP, staleFilter] };
            const agFilter = includeArchived ? staleFilter : { $and: [ACTIVE_FILTER_AGENT, staleFilter] };
            const [capIds, agIds] = await Promise.all([
                capabilitiesColl.find(capFilter).project({ _id: 1 }).toArray(),
                agentsColl.find(agFilter).project({ _id: 1 }).toArray(),
            ]);
            return {
                capability_ids: capIds.map((d) => String(d._id)),
                agent_ids: agIds.map((d) => String(d._id)),
            };
        },
        async archiveStale(options) {
            const { olderThanDays } = options;
            const stale = await store.listStale({ olderThanDays, includeArchived: false });
            const now = new Date().toISOString();
            if (stale.capability_ids.length > 0) {
                await capabilitiesColl.updateMany({ _id: { $in: stale.capability_ids } }, { $set: { archived_at: now, source: "archive" } });
            }
            if (stale.agent_ids.length > 0) {
                await agentsColl.updateMany({ _id: { $in: stale.agent_ids } }, { $set: { archived_at: now, source: "archive" } });
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
export function getRegistryMongoUri(orgRegistryUri) {
    if (typeof orgRegistryUri === "string" && orgRegistryUri.trim())
        return orgRegistryUri.trim();
    const env = process.env.REGISTRY_MONGO_URI ?? process.env.MONGO_URI;
    if (typeof env === "string" && env.trim())
        return env.trim();
    return "mongodb://localhost:27017";
}
//# sourceMappingURL=registry-store.js.map