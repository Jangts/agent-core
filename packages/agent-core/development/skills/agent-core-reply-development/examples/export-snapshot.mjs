/** Explicitly load these trusted fixtures and project their actual registration; do not run cases. */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { agentTests as facts, references as factRefs } from './facts-and-reference.mjs';
import { agentTests as presentation, references as styleRefs } from './presentation-and-style.mjs';

const revision = createHash('sha256');
for (const name of ['facts-and-reference.mjs', 'presentation-and-style.mjs'])
  revision.update(await readFile(new URL(name, import.meta.url)));
const tests = [...facts, ...presentation];
console.log(
  JSON.stringify(
    {
      version: 1,
      subject: { id: 'reply-examples', revision: revision.digest('hex') },
      entries: tests.map(({ entry }) => entry),
      references: [...factRefs, ...styleRefs],
      cases: tests.map(({ id, entry, approach, outputIds = [], referenceIds = [], expected }) => ({
        id,
        entryId: entry.id,
        approach,
        outputIds,
        referenceIds,
        expected,
        evidence: {},
        claims: [],
      })),
    },
    null,
    2,
  ),
);
// No result receipt is fabricated by exporting. Attach actual test/review evidence separately.
