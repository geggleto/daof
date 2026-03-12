/**
 * Vitest setup: register built-in providers and backbones so tests that use
 * bootstrap() or createBackbone() get the same registrations as the CLI.
 */
import "../src/providers/register-providers.js";
import "../src/backbone/register-backbones.js";
