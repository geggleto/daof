/**
 * MongoDB-backed ticket store for workflow run observability.
 * One ticket per run; agents/capabilities append updates via RunContext.
 * Uses same Mongo URI as registry (REGISTRY_MONGO_URI / MONGO_URI); default DB daof_tickets.
 */
import { MongoClient, type Db, type Collection } from "mongodb";
import type { Ticket, TicketStatus, TicketUpdate, TicketMeta } from "./types.js";

const DEFAULT_DB = "daof_tickets";
const TICKETS_COLLECTION = "tickets";

export type { Ticket, TicketUpdate, TicketMeta, TicketStatus, TicketStore } from "./types.js";

export async function createTicketStore(mongoUri: string): Promise<import("./types.js").TicketStore> {
  const client = new MongoClient(mongoUri);
  await client.connect();
  const db: Db = client.db(DEFAULT_DB);
  const coll: Collection<Ticket> = db.collection(TICKETS_COLLECTION);

  await coll.createIndex({ _id: 1 });
  await coll.createIndex({ workflow_id: 1, created_at: -1 });

  return {
    async create(ticketId: string, meta: TicketMeta) {
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

    async appendUpdate(ticketId: string, update: Omit<TicketUpdate, "at">) {
      const full: TicketUpdate = { ...update, at: new Date().toISOString() };
      await coll.updateOne(
        { _id: ticketId },
        {
          $push: { updates: full },
          $set: { updated_at: full.at },
        }
      );
    },

    async setStatus(ticketId: string, status: TicketStatus) {
      const now = new Date().toISOString();
      await coll.updateOne(
        { _id: ticketId },
        { $set: { status, updated_at: now } }
      );
    },

    async get(ticketId: string): Promise<Ticket | null> {
      const doc = await coll.findOne({ _id: ticketId });
      return doc;
    },
  };
}
