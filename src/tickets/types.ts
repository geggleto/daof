import type { JsonValue } from "../types/json.js";

export type TicketStatus = "running" | "completed" | "failed";

/** Single update appended to a ticket (agent/capability/step activity). */
export interface TicketUpdate {
  at: string;
  agent_id?: string;
  capability_id?: string;
  step?: string;
  message?: string;
  payload?: Record<string, JsonValue>;
}

/** Ticket document stored in MongoDB. */
export interface Ticket {
  _id: string;
  workflow_id: string;
  run_id: string;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
  updates: TicketUpdate[];
  /** Optional snapshot of initial input for the run. */
  initial_input?: Record<string, JsonValue>;
}

export interface TicketMeta {
  workflow_id: string;
  run_id: string;
  initial_input?: Record<string, JsonValue>;
}

export interface TicketStore {
  create(ticketId: string, meta: TicketMeta): Promise<void>;
  appendUpdate(ticketId: string, update: Omit<TicketUpdate, "at">): Promise<void>;
  setStatus(ticketId: string, status: TicketStatus): Promise<void>;
  get(ticketId: string): Promise<Ticket | null>;
}
