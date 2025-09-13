#!/usr/bin/env node
const { spawnSync } = require('node:child_process');

function run(cmd, args, opts = {}) {
  const p = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (p.error) {
    console.error(`[codex-ci] Failed to run: ${cmd} ${args.join(' ')}`);
    console.error(p.error);
    process.exit(1);
  }
  if (p.status !== 0) {
    console.error(`[codex-ci] Command exited with code ${p.status}: ${cmd} ${args.join(' ')}`);
    process.exit(p.status ?? 1);
  }
}

// Roles smoke test (Node-only)
run('node', ['tests/roles-smoke.js']);

console.log('\n[codex-ci] ✅ All checks passed');

