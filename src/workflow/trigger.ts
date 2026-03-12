import type { CronTrigger, EventTrigger, ParsedTrigger } from "./types.js";

export type TriggerParser = (trigger: string) => ParsedTrigger | null;

const parsers: TriggerParser[] = [];

/**
 * Register a trigger parser. Parsers are tried in registration order.
 * New trigger formats (e.g. webhook(...)) can be added by registering a parser
 * without editing this file.
 */
export function registerTriggerParser(parser: TriggerParser): void {
  parsers.push(parser);
}

const CRON_REGEX = /^cron\s*\(\s*(.+?)\s*\)$/s;
const EVENT_REGEX = /^event\s*\(\s*(.+?)\s*\)$/s;

function parseCron(trigger: string): ParsedTrigger | null {
  const match = trigger.match(CRON_REGEX);
  if (match) return { type: "cron", expression: match[1].trim() };
  return null;
}

function parseEvent(trigger: string): ParsedTrigger | null {
  const match = trigger.match(EVENT_REGEX);
  if (match) return { type: "event", eventName: match[1].trim() };
  return null;
}

registerTriggerParser(parseCron);
registerTriggerParser(parseEvent);

/**
 * Parse workflow trigger string into CronTrigger or EventTrigger.
 * Uses registered parsers; add new formats via registerTriggerParser.
 */
export function parseTrigger(trigger: string): ParsedTrigger {
  const trimmed = trigger.trim();
  for (const parser of parsers) {
    const result = parser(trimmed);
    if (result !== null) return result;
  }
  throw new Error(`Unsupported trigger format: ${trigger}`);
}
