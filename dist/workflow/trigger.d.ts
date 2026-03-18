import type { ParsedTrigger } from "./types.js";
export type TriggerParser = (trigger: string) => ParsedTrigger | null;
/**
 * Register a trigger parser. Parsers are tried in registration order.
 * New trigger formats (e.g. webhook(...)) can be added by registering a parser
 * without editing this file.
 */
export declare function registerTriggerParser(parser: TriggerParser): void;
/**
 * Parse workflow trigger string into CronTrigger, EventTrigger, or OnDemandTrigger.
 * Uses registered parsers; add new formats via registerTriggerParser.
 */
export declare function parseTrigger(trigger: string): ParsedTrigger;
//# sourceMappingURL=trigger.d.ts.map