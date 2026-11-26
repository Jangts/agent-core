/*
 * Error identity contract for `ValidationError` and `getErrorInfo`.
 *
 * Core wraps work in several boundaries (`executeInvocation`, runners, tools), and
 * each of them must rethrow the caller's own error object rather than a copy, so
 * Apps can compare identity, read their own `reply` field and pass their frozen
 * `issues` array through untouched. Reading an error never mutates it: unknown
 * hosts that expose `errors` are adapted on read, and canonical `issues` win.
 *
 * Runs on `dist/esm` with hand-built error objects; no I/O.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ValidationError, getErrorInfo, executeInvocation } from '../dist/esm/index.js';

test('validation issues and host-owned reply metadata retain the same original error through execution', () => {
  class HostError extends ValidationError {
    reply = 'Application-owned user reply';
  }
  const issue = {
    code: 'USER_INPUT',
    message: 'Application-owned validation message',
    path: ['request'],
  };
  const issues = Object.freeze([issue]);
  // A frozen error with a frozen issue list: nothing in the boundary may copy,
  // extend or wrap it.
  const error = Object.freeze(new HostError(issues));
  assert.throws(
    () =>
      executeInvocation(
        {
          id: 'validate',
          call() {
            throw error;
          },
        },
        {},
        {},
      ),
    (value) => value === error,
  );
  const info = getErrorInfo(error);
  assert.equal(info.cause, error);
  assert.equal(error.reply, 'Application-owned user reply');
  assert.equal(error.issues, issues);
  assert.deepEqual(info.issues, [issue]);
  assert.equal(info.issues[0].message, error.issues[0].message);
  assert.equal('errors' in error, false);
  assert.equal(info.isRetryable, false);
});

test('external errors lists remain an input adapter while canonical issues take precedence', () => {
  const external = Object.assign(new Error('External validation failed'), {
    errors: [{ code: 'EXTERNAL', message: 'External error detail' }],
  });
  assert.deepEqual(getErrorInfo(external).issues, external.errors);
  assert.equal(getErrorInfo(external).cause, external);
  const canonical = Object.assign(new Error('External error with canonical issues'), {
    issues: [{ code: 'CANONICAL', message: 'Canonical issue' }],
    errors: external.errors,
  });
  // When a host exposes both shapes, the canonical `issues` list is authoritative.
  assert.equal(getErrorInfo(canonical).issues[0].code, 'CANONICAL');
  assert.equal(getErrorInfo(canonical).cause, canonical);
});
