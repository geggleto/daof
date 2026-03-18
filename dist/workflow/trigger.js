const parsers = [];
/**
 * Register a trigger parser. Parsers are tried in registration order.
 * New trigger formats (e.g. webhook(...)) can be added by registering a parser
 * without editing this file.
 */
export function registerTriggerParser(parser) {
    parsers.push(parser);
}
const CRON_REGEX = /^cron\s*\(\s*(.+?)\s*\)$/s;
const EVENT_REGEX = /^event\s*\(\s*(.+?)\s*\)$/s;
function parseCron(trigger) {
    const match = trigger.match(CRON_REGEX);
    if (match)
        return { type: "cron", expression: match[1].trim() };
    return null;
}
function parseEvent(trigger) {
    const match = trigger.match(EVENT_REGEX);
    if (match)
        return { type: "event", eventName: match[1].trim() };
    return null;
}
function parseOnDemand(trigger) {
    if (trigger === "on-demand")
        return { type: "on_demand" };
    return null;
}
registerTriggerParser(parseCron);
registerTriggerParser(parseEvent);
registerTriggerParser(parseOnDemand);
/**
 * Parse workflow trigger string into CronTrigger, EventTrigger, or OnDemandTrigger.
 * Uses registered parsers; add new formats via registerTriggerParser.
 */
export function parseTrigger(trigger) {
    const trimmed = trigger.trim();
    for (const parser of parsers) {
        const result = parser(trimmed);
        if (result !== null)
            return result;
    }
    throw new Error(`Unsupported trigger format: ${trigger}`);
}
//# sourceMappingURL=trigger.js.map