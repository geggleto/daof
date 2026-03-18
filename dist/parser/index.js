import { readFileSync, writeFileSync } from "node:fs";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { validate as validateSchema } from "../schema/index.js";
/**
 * Load and parse a YAML file. No env resolution; returns raw parsed value.
 */
export function loadYaml(filePath) {
    const content = readFileSync(filePath, "utf-8");
    return parseYaml(content);
}
/**
 * Parse YAML from a string. Uses the same library as loadYaml.
 */
export function parseYamlString(str) {
    return parseYaml(str);
}
/**
 * Serialize a value to YAML string. Uses the same library as the parser.
 * Comments in the original org file are not preserved when round-tripping.
 */
export function stringifyToYaml(value) {
    return stringifyYaml(value);
}
/**
 * Write an org config to a file as YAML. Overwrites the file.
 * Comments in the original file are lost.
 */
export function writeOrgFile(filePath, config) {
    const yamlStr = stringifyToYaml(config);
    writeFileSync(filePath, yamlStr, "utf-8");
}
/**
 * Validate raw parsed YAML against the Manifest v1 schema. Throws ZodError on invalid input.
 */
export function validate(raw) {
    return validateSchema(raw);
}
//# sourceMappingURL=index.js.map