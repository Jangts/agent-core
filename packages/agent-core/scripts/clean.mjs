/*
 * Remove the build output of the Agent Core package.
 *
 * The script runs as the first step of `npm run build`. It deletes the whole `dist`
 * directory so a build never mixes stale artifacts with newly compiled ones. The
 * `dist/esm` and `dist/cjs` trees are produced by the two TypeScript passes and the
 * module-type marker is written afterwards by `finalize.mjs`.
 *
 * Main exports: none. The file runs as a command.
 */
import { rm } from 'node:fs/promises';
// `force` keeps the step idempotent: removing an absent directory is not an error.
await rm(new URL('../dist/', import.meta.url), { recursive: true, force: true });
