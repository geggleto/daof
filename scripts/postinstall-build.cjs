#!/usr/bin/env node
/**
 * Build dist when missing (e.g. npm i -g from Git). Resolves typescript from
 * hoisted global node_modules, not only ./node_modules/typescript.
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { createRequire } = require("module");

const root = process.cwd();
const distCli = path.join(root, "dist", "cli", "index.js");
if (fs.existsSync(distCli)) {
  process.exit(0);
}

let tscPath;
try {
  tscPath = createRequire(__filename).resolve("typescript/lib/tsc.js");
} catch {
  tscPath = path.join(root, "node_modules", "typescript", "lib", "tsc.js");
}

if (fs.existsSync(tscPath)) {
  execSync(`${JSON.stringify(process.execPath)} ${JSON.stringify(tscPath)}`, {
    stdio: "inherit",
    shell: true,
    cwd: root,
  });
} else {
  execSync("npx --yes -p typescript@5.7.2 tsc", { stdio: "inherit", cwd: root, shell: true });
}
