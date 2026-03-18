import { registerBundled } from "./registry.js";
import { resolvePathUnderBase } from "../../config/path-safety.js";
import { copyFile, mkdir } from "fs/promises";
import { pathToFileURL } from "url";
import { join } from "path";
function getBasePath(def) {
    const c = def.config;
    if (c && typeof c === "object" && "base_path" in c && typeof c.base_path === "string") {
        return c.base_path;
    }
    return process.cwd();
}
function getAllowedSourcePath(def) {
    const c = def.config;
    if (c && typeof c === "object" && "allowed_source_path" in c && typeof c.allowed_source_path === "string") {
        return c.allowed_source_path;
    }
    return getBasePath(def);
}
const DESTINATIONS = ["s3", "local"];
function isDestination(s) {
    return DESTINATIONS.includes(s);
}
/**
 * Bundled FileUploader capability. Input: { file_path, destination: 's3'|'local', metadata? }.
 * Output: { url: string } or { ok: false, error }. Local: copies to config.base_path, returns file:// URL. S3: stub (not implemented).
 */
export function createFileUploaderInstance(_capabilityId, def) {
    const basePath = getBasePath(def);
    const allowedSourceRoot = getAllowedSourcePath(def);
    return {
        async execute(input, _runContext) {
            const filePath = typeof input.file_path === "string" ? input.file_path : "";
            const dest = typeof input.destination === "string" && isDestination(input.destination) ? input.destination : "local";
            if (!filePath) {
                return { ok: false, error: "Missing file_path" };
            }
            if (dest === "s3") {
                return { ok: false, error: "S3 not implemented" };
            }
            try {
                const sourcePath = resolvePathUnderBase(filePath, allowedSourceRoot);
                const { basename } = await import("path");
                const name = basename(sourcePath);
                const destDir = basePath;
                await mkdir(destDir, { recursive: true });
                const destPath = join(destDir, name);
                await copyFile(sourcePath, destPath);
                const url = pathToFileURL(destPath).href;
                return { url };
            }
            catch (err) {
                const error = err instanceof Error ? err.message : String(err);
                return { ok: false, error };
            }
        },
    };
}
registerBundled("file_uploader", createFileUploaderInstance);
//# sourceMappingURL=file_uploader.js.map