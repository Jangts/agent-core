/*
 * Mark the ESM build output as an ES module tree.
 *
 * The script runs as the last step of `npm run build`. The package itself is published
 * as CommonJS, so the `dist/esm` folder needs its own `package.json` with
 * `"type": "module"`; without it Node would read the `.js` files of that folder as
 * CommonJS and the `import` conditions of the package exports would fail.
 *
 * Main exports: none. The file runs as a command.
 */
import { writeFile } from 'node:fs/promises';
// The marker is minimal on purpose: only the module type belongs here.
await writeFile(new URL('../dist/esm/package.json', import.meta.url), '{"type":"module"}\n');
