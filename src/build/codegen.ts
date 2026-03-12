/**
 * Capability codegen: generate TypeScript for new tool capabilities, optionally patch bundled index.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import ora from "ora";
import { getProviderService, getProviderApiKey } from "../providers/registry.js";
import { loadYaml, validate, writeOrgFile } from "../parser/index.js";
import { promptCapabilityCodegen } from "./prompts.js";
import { extractCodeBlock } from "./merge.js";
import { BUNDLED_IDS } from "../capabilities/bundled/index.js";

const CODEGEN_RETRIES = 3;
const BUNDLED_INDEX_FILENAME = "index.ts";

/** Run codegen for one capability; retries up to CODEGEN_RETRIES. Returns code string or throws. */
export async function runCodegenForOne(
  providerId: string,
  id: string,
  def: { description?: string; config?: Record<string, unknown>; depends_on?: string[] },
  verbose: number
): Promise<string> {
  const apiKey = getProviderApiKey(providerId);
  const service = getProviderService(providerId, apiKey);
  if (!service) throw new Error("Codegen requires provider with API key.");
  const configJson = JSON.stringify(def.config ?? {}, null, 2);
  const dependsOn = def.depends_on ?? [];
  const description = def.description ?? "";
  let lastErr: Error | undefined;
  for (let r = 0; r < CODEGEN_RETRIES; r++) {
    try {
      const prompt = promptCapabilityCodegen(id, description, configJson, dependsOn);
      const result = await service.complete(prompt, { max_tokens: 4000 });
      if (!result || ("ok" in result && result.ok === false))
        throw new Error("ok" in result && result.ok === false ? result.error : "Codegen failed");
      const text = ("text" in result ? result.text : "").trim();
      const code = extractCodeBlock(text, "typescript") ?? extractCodeBlock(text);
      if (code) return code;
      throw new Error("No code block in response");
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (verbose >= 2) console.error("[build] Codegen attempt " + (r + 1) + "/" + CODEGEN_RETRIES + " for " + id + ": " + lastErr.message);
    }
  }
  throw new Error(
    "Capability codegen failed for " + id + " after " + CODEGEN_RETRIES + " attempts: " + (lastErr?.message ?? "Unknown error") + ". Check description/config and try again."
  );
}

/** Derive bundled factory name from capability id (snake_case -> createXxxInstance). */
export function capabilityIdToFactoryName(id: string): string {
  const pascal = id
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join("");
  return "create" + pascal + "Instance";
}

/**
 * Normalize generated code from default export to named export for bundled use.
 * Replaces "export default function <AnyName>" with "export function createXxxInstance" and renames the function in the body.
 */
export function normalizeBundledExport(code: string, factoryName: string): { code: string; usedNamedExport: boolean } {
  const match = code.match(/export\s+default\s+function\s+(\w+)/);
  if (!match) return { code, usedNamedExport: false };
  const oldName = match[1];
  let out = code.replace(/export\s+default\s+function\s+\w+/, `export function ${factoryName}`);
  const re = new RegExp("\\b" + oldName.replace(/\W/g, (c) => "\\" + c) + "\\b", "g");
  out = out.replace(re, factoryName);
  return { code: out, usedNamedExport: true };
}

/**
 * Patch src/capabilities/bundled/index.ts: add one import and one registry entry per new id.
 * Skips ids that are already present in the registry. Always uses named import so index stays consistent with bundled modules.
 */
export function patchBundledIndex(
  bundledDir: string,
  additions: { id: string; factoryName: string; usedNamedExport: boolean }[],
  verbose: number
): void {
  if (additions.length === 0) return;
  const indexPath = join(bundledDir, BUNDLED_INDEX_FILENAME);
  let content = readFileSync(indexPath, "utf-8");

  const toAdd = additions.filter(({ id }) => {
    const already = content.includes(`${id}:`);
    if (already && verbose >= 1) console.error("[build] Bundled registry already has " + id + ", skipping.");
    return !already;
  });
  if (toAdd.length === 0) return;

  const importLines = toAdd
    .map(({ id, factoryName }) => `import { ${factoryName} } from "./${id}.js";`)
    .join("\n") + "\n";
  const lastImportMatch = content.match(/(.*\n)(import\s+.*?from\s+["'].*?["'];?\s*\n)([\s\S]*)/);
  const insertAfterImports = lastImportMatch
    ? lastImportMatch[1].length + lastImportMatch[2].length
    : 0;
  content = content.slice(0, insertAfterImports) + importLines + content.slice(insertAfterImports);

  const registryLines = toAdd.map(({ id, factoryName }) => `  ${id}: ${factoryName},`).join("\n") + "\n";
  const registryClose = content.indexOf("};");
  if (registryClose === -1) throw new Error("bundled index.ts: could not find registry closing };");
  content = content.slice(0, registryClose) + registryLines + content.slice(registryClose);

  writeFileSync(indexPath, content, "utf-8");
}

/**
 * Run codegen for all new tool capabilities (not bundled). Loads config from org file, generates source files,
 * sets source on each capability, writes org file again. Returns true if any codegen was done.
 */
export async function runCodegenPhase(
  providerId: string,
  orgFilePath: string,
  newCapabilityIds: string[],
  codegenDir: string,
  verbose: number
): Promise<{ didCodegen: boolean }> {
  const raw = loadYaml(orgFilePath);
  const config = validate(raw);
  let didCodegen = false;
  const dir = join(dirname(orgFilePath), codegenDir);
  mkdirSync(dir, { recursive: true });
  for (const id of newCapabilityIds) {
    const def = config.capabilities[id];
    if (!def || def.type !== "tool" || BUNDLED_IDS.has(id)) continue;
    const codegenSpinner = ora("Codegen " + id + "…").start();
    if (verbose >= 1) console.error("[build] Codegen " + id + "...");
    try {
      const code = await runCodegenForOne(providerId, id, def, verbose);
      const filePath = join(dir, id + ".ts");
      writeFileSync(filePath, code, "utf-8");
      (config.capabilities[id] as Record<string, unknown>).source = codegenDir + "/" + id + ".ts";
      didCodegen = true;
      codegenSpinner.succeed("Codegen " + id + " done.");
      if (verbose >= 1) console.error("[build] Codegen " + id + " done.");
    } catch (e) {
      codegenSpinner.fail("Codegen " + id + " failed.");
      throw e;
    }
  }
  if (didCodegen) writeOrgFile(orgFilePath, config);
  return { didCodegen };
}

/**
 * Run codegen for new tool capabilities and write to framework src/capabilities/bundled/,
 * then patch the bundled index. Requires running from DAOF repo root. Does not set source on capabilities.
 */
export async function runCodegenPhaseForBundle(
  providerId: string,
  orgFilePath: string,
  newCapabilityIds: string[],
  verbose: number
): Promise<{ didCodegen: boolean }> {
  const cwd = process.cwd();
  const bundledDir = join(cwd, "src", "capabilities", "bundled");
  const indexPath = join(bundledDir, BUNDLED_INDEX_FILENAME);
  if (!existsSync(indexPath)) {
    throw new Error(
      "Cannot use --bundle: run from the DAOF repo root so that src/capabilities/bundled exists."
    );
  }
  const raw = loadYaml(orgFilePath);
  const config = validate(raw);
  const additions: { id: string; factoryName: string; usedNamedExport: boolean }[] = [];
  let didCodegen = false;
  for (const id of newCapabilityIds) {
    const def = config.capabilities[id];
    if (!def || def.type !== "tool" || BUNDLED_IDS.has(id)) continue;
    const codegenSpinner = ora("Codegen " + id + " (bundle)…").start();
    if (verbose >= 1) console.error("[build] Codegen " + id + " (bundle)...");
    try {
      const code = await runCodegenForOne(providerId, id, def, verbose);
      const factoryName = capabilityIdToFactoryName(id);
      const { code: normalized, usedNamedExport } = normalizeBundledExport(code, factoryName);
      if (!usedNamedExport) {
        throw new Error(
          `Generated code for ${id} has no default-exported function; bundled capabilities must use "export default function ..." so the build can normalize to a named export.`
        );
      }
      const filePath = join(bundledDir, id + ".ts");
      writeFileSync(filePath, normalized, "utf-8");
      additions.push({ id, factoryName, usedNamedExport });
      didCodegen = true;
      codegenSpinner.succeed("Codegen " + id + " (bundle) done.");
      if (verbose >= 1) console.error("[build] Codegen " + id + " (bundle) done.");
    } catch (e) {
      codegenSpinner.fail("Codegen " + id + " (bundle) failed.");
      throw e;
    }
  }
  if (additions.length > 0) patchBundledIndex(bundledDir, additions, verbose);
  for (const { id } of additions) {
    const cap = config.capabilities[id] as Record<string, unknown> | undefined;
    if (cap) delete cap.source;
  }
  if (didCodegen) writeOrgFile(orgFilePath, config);
  return { didCodegen };
}
