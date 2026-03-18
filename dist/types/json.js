import { z } from "zod";
/**
 * Zod schema for JsonValue (recursive). Use for config, params, goals objects, rogue_detection, etc.
 */
export const JsonValueSchema = z.lazy(() => z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
]));
//# sourceMappingURL=json.js.map