import { type OrgConfig } from "../schema/index.js";
import type { ParsedYaml } from "../types/json.js";
/**
 * Load and parse a YAML file. No env resolution; returns raw parsed value.
 */
export declare function loadYaml(filePath: string): ParsedYaml;
/**
 * Parse YAML from a string. Uses the same library as loadYaml.
 */
export declare function parseYamlString(str: string): ParsedYaml;
/**
 * Serialize a value to YAML string. Uses the same library as the parser.
 * Comments in the original org file are not preserved when round-tripping.
 */
export declare function stringifyToYaml(value: unknown): string;
/**
 * Write an org config to a file as YAML. Overwrites the file.
 * Comments in the original file are lost.
 */
export declare function writeOrgFile(filePath: string, config: OrgConfig): void;
/**
 * Validate raw parsed YAML against the Manifest v1 schema. Throws ZodError on invalid input.
 */
export declare function validate(raw: ParsedYaml): OrgConfig;
//# sourceMappingURL=index.d.ts.map