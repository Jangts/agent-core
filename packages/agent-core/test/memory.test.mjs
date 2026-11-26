import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyMemoryUpdate, memoryUpdateSchema, memoryContext, reviewMemorySources, batchMemorySources,
  isMemoryState, memoryReviewBatch, completeMemoryReview, memoryModelView } from '../dist/esm/kits/memory.js';
const source = (id = 'one', createdAt = 100, question = '请简短回答') => ({ id, createdAt, question, scope: 'session-a' });
const operation = (s, override = {}) => ({ action: 'upsert', key: 'reply-length', kind: 'preference',
  claim: s.question, sourceId: s.id, quote: s.question, scope: 'account', validUntil: null, ...override });
const schema = memoryUpdateSchema(['preference', 'goal']);
test('forged user evidence, assistant-only evidence and unregistered shape are rejected atomically', () => {
  const s = source();
  for (const op of [operation(s, { sourceId: 'other' }), operation(s, { quote: '助手认为用户喜欢茶' })])
    assert.throws(() => applyMemoryUpdate(undefined, [op], [s], 200), /evidence/);
  assert.throws(() => schema.parse({ operations: [operation(s, { kind: 'permission' })] }));
  assert.throws(() => schema.parse({ operations: [], summary: 'fake' }));
  assert.throws(() => schema.parse({ operations: [operation(s, { claim: 'x'.repeat(201) })] }));
});
test('new correction and retraction cannot be resurrected by older transcript review', () => {
  const first = source(), second = source('two', 200, '以后请详细解释'), third = source('three', 300, '撤销这个偏好');
  const a = applyMemoryUpdate(undefined, [operation(first)], [first], 150);
  const b = applyMemoryUpdate(a, [operation(second)], [second], 250);
  assert.equal(a.entries[0].status, 'active');
  assert.equal(b.entries[0].status, 'superseded');
  assert.equal(memoryContext(b, '', 250).summary, second.question);
  const c = applyMemoryUpdate(b, [operation(third, { action: 'retract' })], [third], 350);
  const replay = applyMemoryUpdate(c, [operation(first), operation(second)], [first, second], 400);
  assert.equal(memoryContext(replay, '', 400).summary, '');
  assert.ok(isMemoryState(replay));
  assert.ok(!JSON.stringify(replay).includes('"quote"'));
});
test('goals are scope-bound and expire; absent evidence is never reconstructed', () => {
  const s = source();
  assert.throws(() => applyMemoryUpdate(undefined, [operation(s, { kind: 'goal' })], [s], 200), /expiry/);
  const state = applyMemoryUpdate(undefined, [operation(s, { kind: 'goal', scope: 'session', validUntil: 500 })], [s], 200);
  assert.equal(memoryContext(state, '简短', 300, 'session-b').related.length, 0);
  assert.equal(memoryContext(state, '简短', 300, 'session-a').related.length, 1);
  assert.equal(memoryContext(state, '简短', 500, 'session-a').related.length, 0);
  const reviewed = reviewMemorySources(state, new Map([['one', false]]), 300);
  assert.equal(reviewed.entries[0].evidenceRefs[0].availability, 'unavailable');
  assert.equal(reviewed.entries[0].verification, 'user-stated');
});
test('batch planning preserves whole timestamp groups and user text, and drops oversized assistant context', () => {
  const sources = Array.from({length: 10}, (_, i) => ({ ...source(String(i), 100 + i), answer: 'x'.repeat(800) }));
  const plan = batchMemorySources(sources, 1000, 2, 1100);
  assert.equal(plan.batches.length, 2);
  assert.equal(plan.through, 102);
  assert.deepEqual(plan.batches.flat().map(s => s.id), ['0', '1']);
  const longAnswer = batchMemorySources([{...source(), answer: 'x'.repeat(2000)}], 1000, 1, 500);
  assert.equal(longAnswer.batches[0][0].question, '请简短回答');
  assert.equal(longAnswer.batches[0][0].answer, undefined);
  assert.throws(() => batchMemorySources(sources.map(s => ({...s, createdAt: 100})), 1000, 2, 1100), /timestamp group/);
});
test('review rotates pending entries and reports completion only for inspected sources', () => {
  const sources = Array.from({length: 8}, (_, i) => source(String(i), 100 + i, '请简短回答' + '字'.repeat(100)));
  let state = applyMemoryUpdate(undefined, sources.map((s, i) => operation(s, {key: 'k' + i})), sources, 200);
  state = reviewMemorySources(state, new Map(sources.map(s => [s.id, true])), 1000);
  const first = memoryReviewBatch(state, sources, 1000, 500);
  state = completeMemoryReview(state, first.map(s => s.id), 1000, 1001);
  assert.equal(state.reviewedAt, 0);
  const second = memoryReviewBatch(state, sources, 1000, 500);
  assert.ok(second.every(s => !first.some(p => p.id === s.id)));
});
test('preference projection stays at 300 codepoints and never slices a claim', () => {
  const sources = [source(), source('two', 200)];
  const state = applyMemoryUpdate(undefined, sources.map((s, i) => operation(s, {key: 'k'+i, claim: '🙂'.repeat(200)})), sources, 300);
  assert.equal(Array.from(memoryContext(state, '', 300).summary).length, 200);
  assert.throws(() => memoryContext({...state, entries: [{}]}, '', 300));
});
test('expired goals release capacity and overflow preferences remain bounded candidates', () => {
 let state;
 for(let i=0;i<64;i++) {const s=source('s'+i,100+i);state=applyMemoryUpdate(state,[operation(s,{key:'goal'+i,kind:'goal',validUntil:500})],[s],200);}
 const newest=source('new',600,'请直接给结论');
 state=applyMemoryUpdate(state,[operation(newest)],[newest],700);
 assert.equal(state.entries.filter(e=>e.status==='active').length,1);
 for(let i=0;i<65;i++) {const s=source('p'+i,800+i);state=applyMemoryUpdate(state,[operation(s,{key:'p'+i})],[s],900);}
 assert.equal(state.entries.filter(e=>e.status==='active').length,64);
 assert.ok(state.entries.some(e=>e.status==='needs-review'));
 const repeated=source('again',1000,'重新明确这个偏好');
 state=applyMemoryUpdate(state,[operation(repeated,{key:'p0'})],[repeated],1100);
 assert.ok(state.entries.some(e=>e.key==='p0'&&e.status==='active'));
});
test('retirement floor prevents resurrection after old tombstones leave bounded history', () => {
 const first=source(), retract=source('retract',200,'撤回这个偏好');
 let state=applyMemoryUpdate(undefined,[operation(first)],[first],150);
 state=applyMemoryUpdate(state,[operation(retract,{action:'retract'})],[retract],250);
 assert.equal(state.entries[0].evidenceRefs[0].id,'one');
 assert.equal(state.entries[1].supersedes,state.entries[0].id);
 for(let i=0;i<140;i++){const s=source('x'+i,300+i);state=applyMemoryUpdate(state,[operation(s,{key:'x'+i})],[s],500);}
 state=applyMemoryUpdate(state,[operation(first)],[first],600);
 assert.equal(state.entries.length,128);
 assert.ok(!state.entries.some(e=>e.key==='reply-length'&&e.status==='active'));
});
test('legacy no-op migration remains explicit, expires and supports evidenced span removal', () => {
 const s=source('correction',100,'改用详细回答');
 let state=applyMemoryUpdate(undefined,[],[],200,'偏好简短回答；喜欢爵士乐',500);
 assert.equal(memoryContext(state,'',300).legacySummary,'偏好简短回答；喜欢爵士乐');
 state=applyMemoryUpdate(state,[operation(s,{claim:'偏好详细回答',legacyQuote:'偏好简短回答；'})],[s],300);
 assert.equal(memoryContext(state,'',300).legacySummary,'喜欢爵士乐');
 assert.equal(memoryContext(state,'',500).legacySummary,undefined);
 assert.equal(memoryContext(state,'',500).summary,'偏好详细回答');
 assert.throws(()=>applyMemoryUpdate(undefined,[],[],200,'字'.repeat(301)),/compression/);
});
test('invalid source scope cannot produce an invalid persisted state', () => {
 const s={...source(),scope:'x'.repeat(201)};
 assert.throws(()=>applyMemoryUpdate(undefined,[operation(s,{scope:'session'})],[s],200),/sources/);
 assert.throws(()=>memoryUpdateSchema(['x'.repeat(41)]),/kinds/);
});
test('model view stays bounded and preserves real session identity', async () => {
 const {memoryModelView}=await import('../dist/esm/kits/memory.js');
 const a=source('a',100),b={...source('b',200),scope:'session-b'};
 const state=applyMemoryUpdate(undefined,[operation(a,{key:'goal',kind:'goal',scope:'session',validUntil:1000}),operation(b,{key:'goal',kind:'goal',scope:'session',validUntil:1000})],[a,b],300);
 const view=memoryModelView(state,[a,b]);
 assert.deepEqual(new Set(view.entries.map(e=>e.scopeId)),new Set(['session-a','session-b']));
 assert.ok(JSON.stringify(memoryModelView(state,[a,b],200)).length<1000);
 const {createRequire}=await import('node:module');
 assert.equal(typeof createRequire(import.meta.url)('@jangts/agent-core/kits/memory').applyMemoryUpdate,'function');
});
test('retracting a capacity-deferred entry leaves a tombstone and cancelling a goal needs no new deadline', () => {
 let state;
 const sources=Array.from({length:65},(_,i)=>source('s'+i,100+i));
 for(let i=0;i<sources.length;i++)state=applyMemoryUpdate(state,[operation(sources[i],{key:'k'+i})],[sources[i]],200);
 assert.equal(state.entries.find(e=>e.key==='k0').status,'needs-review');
 const retract=source('retract',300,'撤回第一个偏好');
 state=applyMemoryUpdate(state,[operation(retract,{key:'k0',action:'retract'})],[retract],400);
 state=applyMemoryUpdate(state,[operation(sources[0],{key:'k0'})],[sources[0]],500);
 assert.ok(!state.entries.some(e=>e.key==='k0'&&e.status==='active'));
 const goal=source('goal',600,'本周准备材料');
 state=applyMemoryUpdate(state,[operation(goal,{key:'goal',kind:'goal',validUntil:1000})],[goal],700);
 const cancelled=source('cancel',800,'这个目标已取消');
 state=applyMemoryUpdate(state,[operation(cancelled,{key:'goal',kind:'goal',action:'retract',validUntil:null})],[cancelled],900);
 assert.ok(!state.entries.some(e=>e.key==='goal'&&e.status==='active'));
});
test('rejected old-source operations cannot mutate the legacy block', () => {
 const first=source(), correction=source('newer',200,'以后详细解释');
 let state=applyMemoryUpdate(undefined,[operation(first)],[first],150,'喜欢爵士乐');
 state=applyMemoryUpdate(state,[operation(correction)],[correction],250);
 const replay=applyMemoryUpdate(state,[operation(first,{legacyQuote:'喜欢爵士乐'})],[first],300);
 assert.equal(replay.legacySummary,'喜欢爵士乐');
 assert.equal(memoryContext(replay,'',300).summary,'以后详细解释');
});
test('App scope registration is shared by schema and parser', () => {
 const onlyAccount=memoryUpdateSchema(['preference','goal'],['account']);
 assert.deepEqual(onlyAccount.jsonSchema.properties.operations.items.properties.scope.enum,['account']);
 const s=source();assert.throws(()=>onlyAccount.parse({operations:[operation(s,{scope:'session'})]}),/operation/);
});
test('batching preserves caller order inside one timestamp group', () => {
 const sources=[source('z',100,'先表达'),source('a',100,'后纠正')];
 assert.deepEqual(batchMemorySources(sources,200).batches.flat().map(s=>s.id),['z','a']);
});

test('same-millisecond evidence ordering survives correction, separate replay and retraction', () => {
  const first = { ...source('older'), orderKey: '01' };
  const correction = { ...source('correction', first.createdAt, '以后请详细解释'), orderKey: '02' };
  const retract = { ...source('retract', first.createdAt, '撤回这个偏好'), orderKey: '03' };
  const merged = applyMemoryUpdate(
    undefined, [operation(correction), operation(first)], [correction, first], 110,
  );
  assert.deepEqual(merged.entries.map(entry => entry.evidenceRefs[0].orderKey), ['01', '02']);
  const replayed = applyMemoryUpdate(merged, [operation(first)], [first], 120);
  assert.equal(memoryContext(replayed, '', 120).summary, correction.question);
  const retracted = applyMemoryUpdate(replayed, [operation(retract, { action: 'retract' })], [retract], 130);
  assert.equal(retracted.entries.at(-1).status, 'retracted');
  assert.equal(memoryContext(applyMemoryUpdate(retracted, [operation(correction)], [correction], 140), '', 140).summary, '');
});

test('ambiguous legacy equal-time evidence preserves the established claim until both sources are available', () => {
  const first = source('older');
  const correction = source('correction', first.createdAt, '以后请详细解释');
  const old = applyMemoryUpdate(undefined, [operation(correction)], [correction], 110);
  const replayed = applyMemoryUpdate(old, [operation(first)], [first], 120);
  assert.equal(memoryContext(replayed, '', 120).summary, correction.question);
  const merged = applyMemoryUpdate(old, [operation(first)], [
    { ...correction, orderKey: '01' },
    { ...first, orderKey: '02' },
  ], 130);
  assert.equal(memoryContext(merged, '', 130).summary, first.question);
});

test('already-expired historical goals never consume live capacity or create duplicate versions on replay', () => {
  const preferences = Array.from({ length: 64 }, (_, index) => source('pref-' + index, 10 + index));
  const ops = preferences.map(s => operation(s, { key: s.id }));
  let state;
  for (let i = 0; i < preferences.length; i += 16)
    state = applyMemoryUpdate(state, ops.slice(i, i + 16), preferences.slice(i, i + 16), 80);
  const goal = source('goal', 100, 'Finish this task soon');
  const upsert = operation(goal, { key: 'goal', kind: 'goal', validUntil: 110 });
  const merged = applyMemoryUpdate(state, [upsert], [goal], 120);
  assert.equal(merged.entries.filter(e => e.kind === 'preference' && e.status === 'active').length, 64);
  assert.equal(merged.entries.at(-1).status, 'superseded');
  const replayed = applyMemoryUpdate(merged, [upsert], [goal], 130);
  assert.deepEqual(replayed.entries, merged.entries);
});

test('batch size includes array brackets before falling back to user text alone', () => {
  const s = { ...source(), answer: 'a'.repeat(20) };
  const plan = batchMemorySources([s], 200, 1, JSON.stringify(s).length);
  assert.equal(plan.batches[0][0].question, s.question);
  assert.equal(plan.batches[0][0].answer, undefined);
});

test('kind and scope registration is snapshotted across schema and parser', () => {
  const kinds = ['preference'];
  const scopes = ['account'];
  const registered = memoryUpdateSchema(kinds, scopes);
  kinds.push('goal');
  scopes.push('session');
  const s = source();
  assert.ok(registered.parse({ operations: [operation(s)] }));
  assert.throws(() => registered.parse({ operations: [operation(s, { kind: 'goal' })] }));
  assert.throws(() => registered.parse({ operations: [operation(s, { scope: 'session' })] }));
  const properties = registered.jsonSchema.properties.operations.items.properties;
  assert.deepEqual(properties.kind.enum, ['preference']);
  assert.deepEqual(properties.scope.enum, ['account']);
  assert.throws(() => properties.kind.enum.push('goal'), TypeError);
});

test('invalid snapshots, budgets and legacy spans fail closed at memory boundaries', () => {
  const s = source();
  for (const scopes of [[], ['account', 'account'], ['unknown']])
    assert.throws(() => memoryUpdateSchema(['preference'], scopes), /Invalid memory scopes/);
  const contract = memoryUpdateSchema(['preference']);
  for (const legacySummary of [5, '旧'.repeat(301)])
    assert.throws(() => contract.parse({ operations: [], legacySummary }), /Invalid memory update/);
  assert.throws(() => applyMemoryUpdate({}, [], [], 200), /Invalid memory snapshot/);
  assert.throws(() => applyMemoryUpdate(undefined, [], [], 200, 'old', -1), /Invalid resulting memory snapshot/);
  assert.throws(() => applyMemoryUpdate(undefined, [
    operation(s, { legacyQuote: 'missing quote' }),
  ], [s], 200, 'previous summary'), /Unknown legacy memory span/);
  assert.throws(() => applyMemoryUpdate(undefined, [
    operation(s, { scope: 'session' }),
  ], [{ ...s, scope: undefined }], 200), /Missing memory scope/);
  assert.throws(() => reviewMemorySources({}, new Map(), 200), /Invalid memory review/);
  assert.throws(() => memoryReviewBatch({}, [], 200), /Invalid memory review batch/);
  assert.throws(() => completeMemoryReview({}, [], 200, 201), /Invalid memory review completion/);
  assert.throws(() => memoryModelView({}, []), /Invalid memory model view/);
  assert.deepEqual(memoryContext(undefined, '', 200), { summary: '', related: [] });
  assert.equal(memoryModelView(undefined, []), undefined);
});

test('same-time fallback to App source order only works when both legacy sources are present', () => {
  const first = source('first');
  const correction = source('correction', first.createdAt, 'Prefer detail');
  const state = applyMemoryUpdate(undefined, [operation(first)], [first], 110);
  const reversed = applyMemoryUpdate(state, [operation(correction)], [correction, first], 111);
  assert.equal(memoryContext(reversed, '', 111).summary, first.question);
  const updated = applyMemoryUpdate(state, [operation(correction)], [first, correction], 112);
  assert.equal(memoryContext(updated, '', 112).summary, correction.question);
  const retract = applyMemoryUpdate(updated, [operation(correction, { action: 'retract' })], [correction], 113);
  const replay = applyMemoryUpdate(retract, [operation(correction)], [correction], 114);
  assert.equal(replay.entries.at(-1).status, 'retracted');
  assert.equal(replay.entries.length, retract.entries.length);
  const empty = applyMemoryUpdate(undefined, [operation(first, { action: 'retract' })], [first], 110);
  assert.deepEqual(empty.entries, []);
});

test('memory batching preserves the target boundary and rejects an unfit question before ingestion', () => {
  const s = source();
  assert.throws(() => batchMemorySources([s], 200, 0), /Invalid memory batch budget/);
  assert.throws(() => batchMemorySources([s], 200, 1, 10), /Memory user source exceeds input limit/);
  assert.deepEqual(batchMemorySources([s], s.createdAt), { batches: [], through: s.createdAt });
  const a = { ...source('a'), orderKey: 'a' };
  const b = { ...source('b'), orderKey: 'b' };
  const updates = [operation(a, { key: 'a' }), operation(b, { key: 'b' })];
  for (const ordered of [[a, b], [b, a]]) {
    const state = applyMemoryUpdate(undefined, updates.slice().reverse(), ordered, 200);
    assert.deepEqual(state.entries.map(entry => entry.key), ['a', 'b']);
    assert.equal(memoryContext(state, '', 200).summary, a.question + '；' + b.question);
  }
});

test('review rotates legacy unchecked evidence and expires old goals without requiring model confirmation', () => {
  const a = source('a'), b = source('b', 101);
  const state = applyMemoryUpdate(undefined, [
    operation(a, { key: 'a' }), operation(b, { key: 'b', kind: 'goal', validUntil: 205 }),
  ], [a, b], 200, 'older context');
  for (const entry of state.entries) delete entry.checkedAt;
  assert.deepEqual(memoryReviewBatch(state, [b, a], 202).map(s => s.id), ['a', 'b']);
  assert.throws(() => memoryReviewBatch(state, [a], 202, 10), /Memory review source exceeds input limit/);
  assert.equal(completeMemoryReview(state, ['a'], 202, 203).reviewedAt, 0);
  const reconciled = reviewMemorySources(state, new Map([['a', false]]), 205);
  assert.equal(reconciled.entries[1].status, 'superseded');
  assert.equal(reconciled.entries[0].evidenceRefs[0].availability, 'unavailable');
  assert.equal(completeMemoryReview(reconciled, [], 206, 207).reviewedAt, 207);
  assert.throws(() => memoryModelView(state, [], 10), /Memory view budget cannot fit metadata/);
  assert.deepEqual(memoryModelView(state, [a]).entries.map(entry => entry.scope), ['account', 'account']);
});

test('explicit source order and fallback are stable for three tied inputs', () => {
  const tied = ['a', 'b', 'c'].map(id => ({ ...source(id), orderKey: id }));
  const ordered = applyMemoryUpdate(undefined, tied.map(s => operation(s, { key: s.id })), tied, 200);
  assert.deepEqual(ordered.entries.map(entry => entry.key), ['a', 'b', 'c']);
  const mixed = [{ ...tied[2], orderKey: undefined }, tied[1], tied[0]];
  const fallback = applyMemoryUpdate(undefined, [...mixed].reverse().map(s => operation(s, { key: s.id })), mixed, 200);
  assert.deepEqual(fallback.entries.map(entry => entry.key), ['c', 'b', 'a']);
});
