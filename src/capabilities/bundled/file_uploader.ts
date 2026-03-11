import type { CapabilityInstance, CapabilityInput, CapabilityOutput } from "../../types/json.js";
import type { CapabilityDefinition } from "../../schema/index.js";
import { copyFile, mkdir } from "fs/promises";
import { pathToFileURL } from "url";
import { join } from "path";

function getBasePath(def: CapabilityDefinition): string {
  const c = def.config;
  if (c && typeof c === "object" && "base_path" in c && typeof (c as Record<string, unknown>).base_path === "string") {
    return (c as Record<string, string>).base_path;
  }
  return process.cwd();
}

const DESTINATIONS = ["s3", "local"] as const;
type Destination = (typeof DESTINATIONS)[number];

function isDestination(s: string): s is Destination {
  return DESTINATIONS.includes(s as Destination);
}

/**
 * Bundled FileUploader capability. Input: { file_path, destination: 's3'|'local', metadata? }.
 * Output: { url: string } or { ok: false, error }. Local: copies to config.base_path, returns file:// URL. S3: stub (not implemented).
 */
export function createFileUploaderInstance(
  _capabilityId: string,
  def: CapabilityDefinition
): CapabilityInstance {
  const basePath = getBasePath(def);

  return {
    async execute(
      input: CapabilityInput,
      _runContext?: import("../../runtime/run-context.js").RunContext
    ): Promise<CapabilityOutput> {
      const filePath = typeof input.file_path === "string" ? input.file_path : "";
      const dest = typeof input.destination === "string" && isDestination(input.destination) ? input.destination : "local";

      if (!filePath) {
        return { ok: false, error: "Missing file_path" };
      }

      if (dest === "s3") {
        return { ok: false, error: "S3 not implemented" };
      }

      try {
        const { basename } = await import("path");
        const name = basename(filePath);
        const destDir = basePath;
        await mkdir(destDir, { recursive: true });
        const destPath = join(destDir, name);
        await copyFile(filePath, destPath);
        const url = pathToFileURL(destPath).href;
        return { url };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        return { ok: false, error };
      }
    },
  };
}
