/** Run codegen for one capability; retries up to CODEGEN_RETRIES. Returns code string or throws. */
export declare function runCodegenForOne(providerId: string, id: string, def: {
    description?: string;
    config?: Record<string, unknown>;
    depends_on?: string[];
}, verbose: number): Promise<string>;
/** Derive bundled factory name from capability id (snake_case -> createXxxInstance). */
export declare function capabilityIdToFactoryName(id: string): string;
/**
 * Normalize generated code from default export to named export for bundled use.
 * Replaces "export default function <AnyName>" with "export function createXxxInstance" and renames the function in the body.
 */
export declare function normalizeBundledExport(code: string, factoryName: string): {
    code: string;
    usedNamedExport: boolean;
};
/**
 * Patch src/capabilities/bundled/index.ts: add one import and one registry entry per new id.
 * Skips ids that are already present in the registry. Always uses named import so index stays consistent with bundled modules.
 */
export declare function patchBundledIndex(bundledDir: string, additions: {
    id: string;
    factoryName: string;
    usedNamedExport: boolean;
}[], verbose: number): void;
/**
 * Run codegen for all new tool capabilities (not bundled). Loads config from org file, generates source files,
 * sets source on each capability, writes org file again. Returns true if any codegen was done.
 */
export declare function runCodegenPhase(providerId: string, orgFilePath: string, newCapabilityIds: string[], codegenDir: string, verbose: number): Promise<{
    didCodegen: boolean;
}>;
/**
 * Run codegen for new tool capabilities and write to framework src/capabilities/bundled/,
 * then patch the bundled index. Requires running from DAOF repo root. Does not set source on capabilities.
 */
export declare function runCodegenPhaseForBundle(providerId: string, orgFilePath: string, newCapabilityIds: string[], verbose: number): Promise<{
    didCodegen: boolean;
}>;
//# sourceMappingURL=codegen.d.ts.map