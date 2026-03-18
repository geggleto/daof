/**
 * MongoDB-backed ticket store for workflow run observability.
 * One ticket per run; agents/capabilities append updates via RunContext.
 * Uses same Mongo URI as registry (REGISTRY_MONGO_URI / MONGO_URI); default DB daof_tickets.
 */
import { MongoClient } from "mongodb";
const DEFAULT_DB = "daof_tickets";
const TICKETS_COLLECTION = "tickets";
export async function createTicketStore(mongoUri) {
    const client = new MongoClient(mongoUri);
    await client.connect();
    const db = client.db(DEFAULT_DB);
    const coll = db.collection(TICKETS_COLLECTION);
    await coll.createIndex({ _id: 1 });
    await coll.createIndex({ workflow_id: 1, created_at: -1 });
    return {
        async create(ticketId, meta) {
            const now = new Date().toISOString();
            await coll.insertOne({
                _id: ticketId,
                workflow_id: meta.workflow_id,
                run_id: meta.run_id,
                status: "running",
                created_at: now,
                updated_at: now,
                updates: [],
                ...(meta.initial_input && { initial_input: meta.initial_input }),
            });
        },
        async appendUpdate(ticketId, update) {
            const full = { ...update, at: new Date().toISOString() };
            await coll.updateOne({ _id: ticketId }, {
                $push: { updates: full },
                $set: { updated_at: full.at },
            });
        },
        async setStatus(ticketId, status) {
            const now = new Date().toISOString();
            await coll.updateOne({ _id: ticketId }, { $set: { status, updated_at: now } });
        },
        async get(ticketId) {
            const doc = await coll.findOne({ _id: ticketId });
            return doc;
        },
    };
}
//# sourceMappingURL=ticket-store.js.map