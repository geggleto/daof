import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { validate as validateSchema, type OrgConfig } from "../schema/index.js";
import type { ParsedYaml } from "../types/json.js";

/**
 * Load and parse a YAML file. No env resolution; returns raw parsed value.
 */
export function loadYaml(filePath: string): ParsedYaml {
  const content = readFileSync(filePath, "utf-8");
  return parseYaml(content) as ParsedYaml;
}

/**
 * Validate raw parsed YAML against the Manifest v1 schema. Throws ZodError on invalid input.
 */
export function validate(raw: ParsedYaml): OrgConfig {
  return validateSchema(raw);
}
