/**
 * @file sync-to-siblings.js
 * 
 * Purpose:
 * Local development utility that automatically pushes compiled artifacts (`dist/` and `package.json`)
 * into the `node_modules` of local sibling consumer projects (`ingress-shards.github.io` and
 * `iitc-plugin-site-observer`) after a `yarn build`.
 * 
 * Rationale:
 * Avoids using Yarn `portal:` or local link protocols in `package.json`, preserving strict
 * semantic versioning while enabling instantaneous multi-repo testing without intermediate
 * package publishes.
 * 
 * Behavior:
 * Silently skips if sibling consumer repositories or their `node_modules` directories
 * are not found, ensuring clean, zero-failure runs in isolated CI and Docker builds.
 */

import { existsSync, cpSync } from 'node:fs';
import { resolve } from 'node:path';

const siblings = [
    '../ingress-shards.github.io/node_modules/@ingress-shards/ingress-events-core',
    '../iitc-plugin-site-observer/node_modules/@ingress-shards/ingress-events-core'
];

let syncedCount = 0;
for (const relPath of siblings) {
    const targetDir = resolve(relPath);
    if (existsSync(targetDir)) {
        cpSync('dist', resolve(targetDir, 'dist'), { recursive: true, force: true });
        cpSync('package.json', resolve(targetDir, 'package.json'), { force: true });
        console.log(`[Sync Siblings] Synced core dist to: ${relPath}`);
        syncedCount++;
    }
}

if (syncedCount === 0) {
    console.log('[Sync Siblings] No local sibling workspaces found. Skipping.');
}
