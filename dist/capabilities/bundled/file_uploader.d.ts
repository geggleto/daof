import type { CapabilityInstance } from "../../types/json.js";
import type { CapabilityDefinition } from "../../schema/index.js";
/**
 * Bundled FileUploader capability. Input: { file_path, destination: 's3'|'local', metadata? }.
 * Output: { url: string } or { ok: false, error }. Local: copies to config.base_path, returns file:// URL. S3: stub (not implemented).
 */
export declare function createFileUploaderInstance(_capabilityId: string, def: CapabilityDefinition): CapabilityInstance;
//# sourceMappingURL=file_uploader.d.ts.map