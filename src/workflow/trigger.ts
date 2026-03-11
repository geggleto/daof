import type { CronTrigger, EventTrigger, ParsedTrigger } from "./types.js";

const CRON_REGEX = /^cron\s*\(\s*(.+?)\s*\)$/s;
const EVENT_REGEX = /^event\s*\(\s*(.+?)\s*\)$/s;

/**
 * Parse workflow trigger string into CronTrigger or EventTrigger.
 */
export function parseTrigger(trigger: string): ParsedTrigger {
  const trimmed = trigger.trim();
  const cronMatch = trimmed.match(CRON_REGEX);
  if (cronMatch) {
    return { type: "cron", expression: cronMatch[1].trim() };
  }
  const eventMatch = trimmed.match(EVENT_REGEX);
  if (eventMatch) {
    return { type: "event", eventName: eventMatch[1].trim() };
  }
  throw new Error(`Unsupported trigger format: ${trigger}`);
}
