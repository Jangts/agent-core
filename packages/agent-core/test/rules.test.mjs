/**
 * Locks down the shared rule helpers: `matchRule` first-match ownership, `walkRules`
 * ordered mutation and prechecks, and `breakWhile` laziness, batch short-circuiting,
 * diagnostic tags and observer isolation. Runs under node --test as pure unit tests.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { breakWhile, configureBreakWhile, matchRule, walkRules } from '../dist/esm/index.js';

test('first matching rule owns undefined results and thrown errors', () => {
  let fallback = 0;
  const tail = {
    id: 'fallback',
    description: 'fallback',
    pattern: () => true,
    handle: () => {
      fallback++;
      return 1;
    },
  };
  assert.equal(
    matchRule(
      [{ id: 'first', description: 'first', pattern: () => true, handle: () => undefined }, tail],
      {},
    ),
    undefined,
  );
  const error = new TypeError('selected rejection');
  assert.throws(
    () =>
      matchRule(
        [
          {
            id: 'reject',
            description: 'reject',
            pattern: () => true,
            handle: () => {
              throw error;
            },
          },
          tail,
        ],
        {},
      ),
    (caught) => caught === error,
  );
  // The first matching rule owns the outcome even when it returns undefined or throws, so
  // the fallback never runs.
  assert.equal(fallback, 0);
});

test('ordered predicates retain precedence and receive the same input', () => {
  const input = { scope: 'sounds', unit: 'track' };
  const seen = [];
  const rules = [
    {
      id: 'tracks',
      description: 'specific',
      pattern: (value) => {
        seen.push(value);
        return value.scope === 'sounds' && value.unit === 'track';
      },
      handle: (value) => value,
    },
    {
      id: 'sounds',
      description: 'general',
      pattern: () => {
        throw new Error('shadowed predicate');
      },
      handle: () => null,
    },
  ];
  assert.equal(matchRule(rules, input), input);
  // Only the winning predicate ran: the shadowed predicate throwing proves evaluation stops
  // at the first match.
  assert.deepEqual(seen, [input]);
});

test('omitted patterns match in place and preserve first-match ownership', () => {
  const input = { value: 3 };
  let later = 0;
  const fallback = { id: 'default', description: 'default', handle: (value) => value };
  assert.equal(
    matchRule(
      [
        { id: 'miss', description: 'miss', pattern: () => false, handle: () => null },
        fallback,
        {
          id: 'later',
          description: 'later',
          pattern: () => {
            later++;
            return true;
          },
          handle: () => null,
        },
      ],
      input,
    ),
    input,
  );
  assert.equal(later, 0);
  assert.equal(
    matchRule(
      [
        { ...fallback, handle: () => undefined },
        {
          ...fallback,
          handle: () => {
            later++;
          },
        },
      ],
      input,
    ),
    undefined,
  );
  assert.equal(later, 0);
  const error = new Error('default rejection');
  assert.throws(
    () =>
      matchRule(
        [
          {
            ...fallback,
            handle: () => {
              throw error;
            },
          },
          fallback,
        ],
        input,
      ),
    (caught) => caught === error,
  );
});

test('walk evaluates later predicates against updated input without revisiting earlier rules', () => {
  const input = { value: 0 };
  const order = [];
  const rules = [
    {
      pattern: (value) => value.value === 1,
      handle: () => {
        throw new Error('must not revisit');
      },
    },
    {
      handle: (value) => {
        assert.equal(value, input);
        order.push('first');
        value.value = 1;
        return false;
      },
    },
    {
      pattern: (value) => value.value === 1,
      handle: (value) => {
        order.push('second');
        value.value = 2;
      },
    },
    {
      handle: (value) => {
        order.push('last');
        assert.equal(value.value, 2);
      },
    },
  ];
  assert.equal(walkRules(rules, input), undefined);
  // A handler returning false continues the walk, later predicates see the mutated input,
  // and step one is never revisited.
  assert.deepEqual(order, ['first', 'second', 'last']);
  assert.equal(walkRules([]), undefined);
});

test('walk supports closure rules and runs prechecks before matching even for skipped rules', () => {
  const order = [];
  let ready = false;
  walkRules([
    {
      before: () => {
        order.push('before');
        ready = true;
      },
      pattern: () => {
        order.push('pattern');
        return false;
      },
      handle: () => {
        throw new Error('skipped');
      },
    },
    {
      pattern: () => ready,
      handle: () => {
        order.push('ready');
      },
    },
    {
      handle: () => {
        order.push('unconditional');
      },
    },
  ]);
  // `before` prechecks run for every rule, including rules whose pattern is false.
  assert.deepEqual(order, ['before', 'pattern', 'ready', 'unconditional']);
});

test('walk preserves exceptions and stops before evaluating or executing later rules', () => {
  for (const phase of ['before', 'pattern', 'handle']) {
    const error = new TypeError(phase);
    let later = 0;
    const rule = { handle: () => {} };
    rule[phase] = () => {
      throw error;
    };
    assert.throws(
      () =>
        walkRules([
          rule,
          {
            before: () => {
              later++;
            },
            pattern: () => {
              later++;
              return true;
            },
            handle: () => {
              later++;
            },
          },
        ]),
      (caught) => caught === error,
    );
    assert.equal(later, 0);
  }
});

test('single rejection constructs errors only on a match and preserves forwarded errors', () => {
  let builds = 0;
  // No rejection, no factory call: error construction is lazy.
  breakWhile(false, () => {
    builds++;
    return new Error('unused');
  });
  assert.equal(builds, 0);
  const forwarded = new TypeError('original');
  assert.throws(
    () => breakWhile(true, () => forwarded),
    (caught) => caught === forwarded,
  );
  assert.throws(() => breakWhile(true, () => 'message'), { name: 'Error', message: 'message' });
  assert.throws(
    () => breakWhile(true),
    (error) => error.constructor === Error && error.message === '',
  );
  class PayloadError extends Error {
    constructor(payload) {
      super(payload.code);
      this.payload = payload;
    }
  }
  const payload = { code: 'FORBIDDEN', status: 403 };
  assert.throws(
    () => breakWhile(true, () => new PayloadError(payload)),
    (error) => error instanceof PayloadError && error.payload === payload,
  );
});

test('batch rejection stops before dependent checks or later error construction', () => {
  const order = [];
  const error = new Error('first rejection');
  assert.throws(
    () =>
      breakWhile([
        {
          occur: () => {
            order.push('valid');
            return false;
          },
        },
        {
          occur: () => {
            order.push('invalid');
            return true;
          },
          error: () => {
            order.push('error');
            return error;
          },
        },
        {
          occur: () => {
            throw new Error('must not evaluate');
          },
          error: () => {
            throw new Error('must not construct');
          },
        },
      ]),
    (caught) => caught === error,
  );
  assert.deepEqual(order, ['valid', 'invalid', 'error']);
  // Dependent and later rules are not evaluated once the first rejection is chosen.
  assert.throws(
    () => breakWhile([{ occur: false }, { occur: true }]),
    (caught) => caught.constructor === Error && caught.message === '',
  );
  assert.throws(() => breakWhile([{ occur: true, error: () => 'batch message' }]), {
    name: 'Error',
    message: 'batch message',
  });
});

test('single conditions keep normal truthiness without invoking registered function values', () => {
  let invoked = 0;
  const registered = () => {
    invoked++;
    return false;
  };
  assert.throws(() => breakWhile(registered, 'already registered'), /already registered/);
  assert.throws(
    () => breakWhile([{ occur: () => registered, error: () => 'already registered' }]),
    /already registered/,
  );
  assert.equal(invoked, 0);
});

test('shared conditions keep OR short-circuiting and construct one common error lazily', () => {
  let builds = 0;
  // Neither an all-false nor an empty condition list constructs the shared error.
  breakWhile([() => false, () => undefined], () => {
    builds++;
    return new Error('unused');
  });
  breakWhile([], () => {
    builds++;
    return new Error('unused');
  });
  assert.equal(builds, 0);
  const error = new Error('shared');
  assert.throws(
    () =>
      breakWhile(
        [
          () => false,
          () => true,
          () => {
            throw new Error('dependent predicate must not run');
          },
        ],
        () => {
          builds++;
          return error;
        },
      ),
    (caught) => caught === error,
  );
  assert.equal(builds, 1);
  assert.throws(() => breakWhile([() => false, () => true]), { name: 'Error', message: '' });
});

test('rule and call tags merge for diagnostics without filtering rules or changing error priority', () => {
  const events = [];
  const tags = ['global', 'shared'];
  configureBreakWhile({
    onBreak: (event) => {
      events.push(event);
    },
  });
  try {
    assert.throws(
      () =>
        breakWhile(
          [
            { occur: () => false, error: 'unused', tags: ['global'] },
            {
              occur: [
                () => false,
                () => true,
                () => {
                  throw new Error('must stop');
                },
              ],
              error: 'selected',
              tags: ['other', 'shared'],
            },
            {
              occur: () => {
                throw new Error('later rule must not run');
              },
            },
          ],
          tags,
        ),
      /selected/,
    );
    assert.equal(events.length, 1);
    // Rule tags merge after the call tags, in rule order, and both originals stay untouched.
    assert.deepEqual(events[0].tags, ['global', 'shared', 'other']);
    assert.deepEqual(tags, ['global', 'shared']);
    assert.equal(Object.isFrozen(events[0].tags), true);
  } finally {
    configureBreakWhile();
  }
});

test('single and shared-condition overloads accept diagnostic tags with or without an error', () => {
  const events = [];
  configureBreakWhile({
    onBreak: (event) => {
      events.push(event);
    },
  });
  try {
    assert.throws(() => breakWhile(true, ['single']), { name: 'Error', message: '' });
    assert.throws(() => breakWhile(true, 'message', ['single', 'message']), /message/);
    assert.throws(() => breakWhile(true, undefined, ['default']), { name: 'Error', message: '' });
    assert.throws(() => breakWhile([() => true], ['shared']), { name: 'Error', message: '' });
    assert.throws(
      () => breakWhile([() => true], 'shared message', ['shared', 'message']),
      /shared message/,
    );
    assert.deepEqual(
      events.map((event) => event.tags),
      [['single'], ['single', 'message'], ['default'], ['shared'], ['shared', 'message']],
    );
  } finally {
    configureBreakWhile();
  }
});

test('rules sharing an error retain separate diagnostic groups and first-match priority', () => {
  const events = [];
  const error = new Error('shared public failure');
  configureBreakWhile({
    onBreak: (event) => {
      events.push(event);
    },
  });
  try {
    for (const [identityInvalid, valuesInvalid] of [
      [true, true],
      [false, true],
    ]) {
      assert.throws(
        () =>
          breakWhile(
            [
              { occur: [() => identityInvalid, () => false], error, tags: ['identity'] },
              { occur: [() => valuesInvalid, () => false], error, tags: ['values'] },
            ],
            ['registration'],
          ),
        (caught) => caught === error,
      );
    }
    assert.deepEqual(
      events.map((event) => event.tags),
      [
        ['registration', 'identity'],
        ['registration', 'values'],
      ],
    );
    assert.equal(events.length, 2);
  } finally {
    configureBreakWhile();
  }
});

test('predicate and factory exceptions are observed once and forwarded unchanged', () => {
  const events = [];
  const predicateError = new TypeError('predicate');
  const factoryError = new Error('factory');
  let factoryCalls = 0;
  configureBreakWhile({
    onBreak: (event) => {
      events.push(event);
    },
  });
  try {
    assert.throws(
      () =>
        breakWhile(
          [
            () => {
              throw predicateError;
            },
          ],
          () => {
            factoryCalls++;
            return new Error('unused');
          },
          ['predicate'],
        ),
      (caught) => caught === predicateError,
    );
    assert.equal(factoryCalls, 0);
    assert.throws(
      () =>
        breakWhile(
          true,
          () => {
            throw factoryError;
          },
          ['factory'],
        ),
      (caught) => caught === factoryError,
    );
    assert.deepEqual(
      events.map((event) => event.error),
      [predicateError, factoryError],
    );
    assert.deepEqual(
      events.map((event) => event.tags),
      [['predicate'], ['factory']],
    );
  } finally {
    configureBreakWhile();
  }
});

test('observer failures and reset never change synchronous rejection or cause unhandled rejections', async () => {
  // Observer exceptions must not replace, delay or suppress the original synchronous error.
  const error = new Error('validation');
  configureBreakWhile({
    onBreak: () => {
      throw new Error('observer');
    },
  });
  try {
    assert.throws(
      () => breakWhile(true, error),
      (caught) => caught === error,
    );
    let nested = 0;
    configureBreakWhile({
      onBreak: () => {
        nested++;
        breakWhile(true, 'diagnostic failure');
      },
    });
    assert.throws(
      () => breakWhile(true, error),
      (caught) => caught === error,
    );
    assert.equal(nested, 1);
    let observed = 0;
    configureBreakWhile({
      onBreak: async () => {
        observed++;
        throw new Error('async observer');
      },
    });
    assert.throws(
      () => breakWhile(true, error),
      (caught) => caught === error,
    );
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(observed, 1);
    configureBreakWhile();
    assert.throws(
      () => breakWhile(true, error),
      (caught) => caught === error,
    );
    assert.equal(observed, 1);
  } finally {
    configureBreakWhile();
  }
});

test('occur is the refusal field and stale or mixed check fields cannot silently skip rejection', () => {
  assert.doesNotThrow(() => breakWhile([{ occur: false }]));
  // Legacy field names are rejected outright so an unwritten rule cannot silently pass.
  const error = new Error('refused');
  assert.throws(
    () => breakWhile([{ occur: true, error }]),
    (caught) => caught === error,
  );
  assert.throws(() => breakWhile([{ condition: true }]), /renamed to occur/);
  assert.throws(() => breakWhile([{ conditions: [() => true] }]), /renamed to occur/);
});
