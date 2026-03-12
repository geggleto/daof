import { writeFile } from "node:fs/promises";
import type { CapabilityInstance, CapabilityInput, CapabilityOutput } from "../../types/json.js";
import type { RunContext } from "../../runtime/run-context.js";
import type { CapabilityDefinition } from "../../schema/index.js";

export default function createWriteGreetingInstance(
  _capabilityId: string,
  _def: CapabilityDefinition
): CapabilityInstance {
  return {
    async execute(
      input: CapabilityInput,
      _runContext?: RunContext
    ): Promise<CapabilityOutput> {
      const name =
        typeof input.name === "string" && input.name.length > 0
          ? input.name
          : "World";
      const filePath =
        typeof input.file_path === "string" && input.file_path.length > 0
          ? input.file_path
          : "./greeting.txt";
      const greeting = `Hello, ${name}!`;
      await writeFile(filePath, greeting, "utf-8");
      return { file_path: filePath, greeting };
    },
  };
}