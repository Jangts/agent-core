/**
 * Locks down the text-skill Kit and evidence projection in both module formats: header
 * parsing, path/id/tool validation, read-count behaviour, document limits and evidence
 * narrowing. Runs under node --test twice, once through the ESM entry and once through
 * CommonJS, with in-memory read ports.
 */
import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as core from '@jangts/agent-core';
import * as kits from '@jangts/agent-core/kits';
const esm = { ...core, ...kits };
for (const [format, api] of [
  ['ESM', esm],
  [
    'CJS',
    {
      ...createRequire(import.meta.url)('@jangts/agent-core'),
      ...createRequire(import.meta.url)('@jangts/agent-core/kits'),
    },
  ],
]) {
  const test = (name, ...args) => nodeTest(`${format}: ${name}`, ...args);
  const { defineTextSkillLoader, defineEvidenceProjection } = api;

  const entry = (id = 'summary') => ({
    id,
    entry: `${id}/SKILL.md`,
    kind: 'text-workflow',
    toolIds: ['documents.read'],
  });
  const document = (id = 'summary') =>
    `---\nname: ${id}\ndescription: Summarize real documents\n---\nRead evidence before summarizing.`;
  const loader = () =>
    defineTextSkillLoader({ maxInstructionChars: 500, maxDescriptionChars: 100 });

  test('text skills retain validated instructions and freeze registered metadata without executing any tool', () => {
    const registration = entry(),
      reads = [];
    const skills = loader().load(
      { entries: [registration] },
      {
        read: (file) => {
          reads.push(file);
          return document();
        },
      },
    );
    registration.toolIds.push('foreign.tool');
    // The registration is snapshotted: mutating its toolIds after load does not widen the
    // skill, and the document was read exactly once.
    assert.deepEqual(reads, ['summary/SKILL.md']);
    assert.deepEqual(skills[0].toolIds, ['documents.read']);
    assert.equal(skills[0].instructions, document());
    assert.ok(
      Object.isFrozen(skills) && Object.isFrozen(skills[0]) && Object.isFrozen(skills[0].toolIds),
    );
  });

  test('skill registrations reject escaped paths, duplicate ids, executable modes and invalid tools before document reads', () => {
    // Every invalid registration must fail before the read port is touched, so a bad catalog
    // cannot probe the filesystem.
    for (const entries of [
      null,
      [{ ...entry(), entry: '../outside.md' }],
      [{ ...entry(), kind: 'script' }],
      [{ ...entry(), toolIds: [''] }],
      [{ ...entry(), id: '../summary' }],
    ]) {
      let reads = 0;
      assert.throws(() =>
        loader().load(
          { entries: entries },
          {
            read: () => {
              reads++;
              return document();
            },
          },
        ),
      );
      assert.equal(reads, 0);
    }
    let reads = 0;
    assert.throws(() =>
      loader().load(
        { entries: [entry(), entry()] },
        {
          read: () => {
            reads++;
            return document();
          },
        },
      ),
    );
    assert.equal(reads, 1, 'a later duplicate never triggers another read');
  });

  test('document identity, description and content limits fail without truncation and read errors propagate', () => {
    // A mismatched name, blank description or oversized body is rejected outright: the
    // loader never truncates to make an invalid document fit.
    for (const invalid of [
      document('other'),
      document().replace('Summarize real documents', ' '),
      document() + 'x'.repeat(500),
    ]) {
      assert.throws(
        () => loader().load({ entries: [entry()] }, { read: () => invalid }),
        /Invalid text skill document/,
      );
    }
    const error = new Error('read failed');
    assert.throws(
      () =>
        loader().load(
          { entries: [entry()] },
          {
            read: () => {
              throw error;
            },
          },
        ),
      (value) => value === error,
    );
  });

  test('applications can supply another metadata parser and catalog naming convention', () => {
    const reader = defineTextSkillLoader({
      maxInstructionChars: 500,
      maxDescriptionChars: 100,
      entryFor: (id) => `${id}.md`,
      parseHeader: (text) => ({ id: 'summary', description: text.split('\n')[0] }),
    });
    const [skill] = reader.load(
      { entries: [{ ...entry(), entry: 'summary.md' }] },
      { read: () => 'Summary guide\nVerified instructions' },
    );
    assert.equal(skill.description, 'Summary guide');
  });

  test('evidence projection narrows selected sources without altering totals, other observations or original evidence', () => {
    const projection = defineEvidenceProjection({
      sourceId: (source) => source.id,
      providers: {
        documents: {
          sources: (observation) => observation.result.items,
          withSources: (observation, items) => ({
            ...observation,
            result: { ...observation.result, items },
          }),
        },
      },
    });
    const observations = [
      {
        tool: 'documents',
        input: 'query',
        result: { total: 2, items: [{ id: 'one' }, { id: 'two' }] },
      },
      { tool: 'operation', result: { status: 'prepared' } },
    ];
    assert.equal(projection.project({ observations }), observations);
    const selected = projection.project({ observations, sourceIds: ['two'] });
    assert.deepEqual(selected[0].result, { total: 2, items: [{ id: 'two' }] });
    // Totals stay as reported, unrelated observations keep their identity, and the original
    // evidence is not mutated.
    assert.equal(selected[1], observations[1]);
    assert.equal(observations[0].result.items.length, 2);
    assert.deepEqual(
      projection.project({ observations, sourceIds: ['unknown'] })[0].result.items,
      [],
    );
  });

  test('text skill loaders accept class registrations and readers without losing private receivers', () => {
    class Entry {
      get id() {
        return 'summary';
      }
      get entry() {
        return 'summary/SKILL.md';
      }
      get kind() {
        return 'text-workflow';
      }
      get toolIds() {
        return ['documents.read'];
      }
    }
    class ReadPorts {
      #body = document();
      read(path) {
        assert.equal(path, 'summary/SKILL.md');
        return this.#body;
      }
    }
    const skills = loader().load({ entries: [new Entry()] }, new ReadPorts());
    assert.equal(skills[0].id, 'summary');
    assert.equal(skills[0].instructions, document());
    let reads = 0;
    assert.throws(() =>
      loader().load(
        { entries: [{ entry: 'undefined/SKILL.md', kind: 'text-workflow', toolIds: [] }] },
        {
          read() {
            reads++;
            return document();
          },
        },
      ),
    );
    assert.throws(() =>
      loader().load(
        { entries: [{ ...entry(), toolIds: ['documents.read', 'documents.read'] }] },
        {
          read() {
            reads++;
            return document();
          },
        },
      ),
    );
    assert.equal(reads, 0);
  });

  test('text skill error factories preserve their owner and legacy fields do not trigger reads', () => {
    const failure = new Error('registration');
    class Errors {
      #failure = failure;
      registration() {
        return this.#failure;
      }
    }
    const reader = defineTextSkillLoader({
      maxInstructionChars: 500,
      maxDescriptionChars: 100,
      errors: new Errors(),
    });
    let reads = 0;
    // The configured error factory keeps its receiver, and legacy `status`/`tools` fields
    // are rejected before the read port is touched.
    assert.throws(
      () =>
        reader.load(
          {
            entries: [
              { id: 'summary', entry: 'summary/SKILL.md', status: 'text-workflow', tools: [] },
            ],
          },
          {
            read() {
              reads++;
              return document();
            },
          },
        ),
      (error) => error === failure,
    );
    assert.equal(reads, 0);
  });
}
