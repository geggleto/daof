/**
 * Load .env and .env.local from process.cwd() so the CLI sees CURSOR_API_KEY, etc.
 * This module is imported first in the CLI so it runs before register-providers and others.
 */
import path from "node:path";
import { config } from "dotenv";
const cwd = process.cwd();
config({ path: path.join(cwd, ".env") });
config({ path: path.join(cwd, ".env.local") });
//# sourceMappingURL=load-env.js.map