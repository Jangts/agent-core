import test from 'node:test';
import assert from 'node:assert/strict';
import { defineResultReview, checkReviewAdmission } from '../dist/esm/kits/result-review.js';
const context = () => ({ app: {}, signal: new AbortController().signal });
const request = () => ({ scope: { id: 'question', contentRevision: '1', policyRevision: 'p1' }, inputs: ['a','b'].map(id => ({ id, scopeId: 'question', sourceId: id, versions: [{ resourceId: 'doc', revision: '1' }], evidenceIds: [id], value: { answer: id } })) });
const finding = (overrides = {}) => ({ id: 'difference', kind: 'semantic', state: 'suspected', inputIds: ['a','b'], evidenceIds: ['a','b'], reason: 'Different suggestions', blocking: true, ...overrides });
const detector = (overrides = {}) => ({ id: 'compare', candidates: () => [{ id: 'pair', inputIds: ['a','b'] }], run: () => ({ findings: [finding()], complete: true }), ...overrides });
const admission = result => ({ result, requiredDetectorIds: ['compare'], scopeId: 'question', contentRevision: '1', policyRevision: 'p1' });

test('inspection preserves business types, receiver, scope and independent coverage', async () => {
 class Detector { #calls = 0; id='compare'; candidates() { this.#calls++; return [{ id: 'pair', inputIds: ['a','b'] }]; } run(_c, r) { assert.equal(this.#calls,1); assert.equal(r.inputs[0].value.answer,'a'); return { findings:[finding()], complete:false, reason:'remaining evidence' }; } }
 const input=request();
 const result=await defineResultReview({detectors:[new Detector()]}).inspect(input,context());
 assert.equal(result.findings[0].id,'compare:difference');
 assert.equal(result.coverage[0].status,'partial');
 assert.equal(result.findings[0].state,'suspected');
 assert.equal(checkReviewAdmission(admission(result)).allowed,false);
});
test('limits expose skipped work and no findings is not admission', async () => {
 const review=defineResultReview({detectors:[detector()]});
 const result=await review.inspect({...request(),maxCandidates:0},context());
 assert.deepEqual(result.findings,[]); assert.equal(result.coverage[0].status,'not-run');
 assert.equal(checkReviewAdmission(admission(result)).allowed,false);
});
test('candidate, evidence, scope and duplicate identities cannot be invented',async()=>{
 for(const entry of [detector({candidates:()=>[{id:'pair',inputIds:['evil']}]}),detector({run:()=>({findings:[finding({evidenceIds:['evil']})],complete:true})}),detector({run:()=>({findings:[finding({inputIds:['a'],evidenceIds:['b']})],complete:true})}),detector({run:()=>({findings:[],complete:'yes'})})]) {
  await assert.rejects(defineResultReview({detectors:[entry]}).inspect(request(),context()),TypeError);
 }
 const bad=request();bad.inputs[0].scopeId='other';await assert.rejects(defineResultReview({detectors:[]}).inspect(bad,context()),TypeError);
 assert.throws(()=>defineResultReview({detectors:[detector(),detector()]}),TypeError);
});
test('detector failure is incomplete; deadline and cancellation propagate',async()=>{
 const result=await defineResultReview({detectors:[detector({run(){throw Error('offline');}})]}).inspect(request(),context());
 assert.equal(result.coverage[0].status,'failed');assert.equal(checkReviewAdmission(admission(result)).allowed,false);
 const timeout=Object.assign(Error('deadline'),{name:'TimeoutError'});
 await assert.rejects(defineResultReview({detectors:[detector({run(){throw timeout;}})]}).inspect(request(),context()),e=>e===timeout);
 const controller=new AbortController(); const reason=Error('stopped');
 const pending=defineResultReview({detectors:[detector({run(){controller.abort(reason);return new Promise(()=>{});}})]}).inspect(request(),{app:{},signal:controller.signal});
 await assert.rejects(pending,e=>e===reason);
});
test('admission defaults to unresolved blocking findings, rejects stale scope and unknown resolutions',async()=>{
 const result=await defineResultReview({detectors:[detector()]}).inspect(request(),context());
 assert.equal(checkReviewAdmission(admission(result)).allowed,false);
 assert.equal(checkReviewAdmission({...admission(result),resolvedFindingIds:['compare:difference']}).allowed,true);
 for(const overrides of [{scopeId:'other'},{contentRevision:'2'},{policyRevision:'p2'}]) assert.equal(checkReviewAdmission({...admission(result),...overrides,resolvedFindingIds:['compare:difference']}).allowed,false);
 assert.throws(()=>checkReviewAdmission({...admission(result),resolvedFindingIds:['invented']}),TypeError);
 assert.equal(checkReviewAdmission({...admission({...result,coverage:[]}),resolvedFindingIds:['compare:difference']}).allowed,false);
});
test('bounded resolution stops on no progress without silently resolving findings',async()=>{
 let calls=0;
 const review=defineResultReview({detectors:[detector()],strategies:[{id:'verify',when:()=>true,run(){calls++;return {status:'unresolved',reason:'same evidence',progress:'same'};}}]});
 const result=await review.inspect(request(),context());
 const decisions=await review.resolve(request(),result,context(),{maxRounds:5});
 assert.equal(calls,2);assert.equal(decisions[0].reason,'no-progress');assert.equal(decisions[0].status,'unresolved');assert.equal(checkReviewAdmission(admission(result)).allowed,false);
 const changed=request();changed.scope.contentRevision='2';await assert.rejects(review.resolve(changed,result,context()),/Stale/);
});
test('resolution handles needs-answer, no policy and zero rounds without extra work',async()=>{
 const review=defineResultReview({detectors:[detector()],strategies:[{id:'ask',when:()=>true,run:()=>({status:'needs-answer',reason:'Preference required'})}]});
 const result=await review.inspect(request(),context());
 assert.equal((await review.resolve(request(),result,context()))[0].status,'needs-answer');
 assert.equal((await review.resolve(request(),result,context(),{maxRounds:0}))[0].rounds,0);
 const none=defineResultReview({detectors:[]});assert.equal((await none.resolve(request(),result,context()))[0].reason,'no-strategy');
});
test('trusted blocking policy overrides model flags and preserves predicate receiver',async()=>{
 const review=defineResultReview({detectors:[detector({blocking:true,run:()=>({findings:[finding({blocking:false})],complete:true})})]});
 const result=await review.inspect(request(),context());
 assert.equal(result.findings[0].blocking,true);assert.equal(checkReviewAdmission(admission(result)).allowed,false);
 class BoundDetector { #kind='semantic'; id='compare'; candidates=detector().candidates; run=detector().run; blocking(value) { assert.equal(value.id,'compare:difference');return value.kind===this.#kind; } }
 assert.equal((await defineResultReview({detectors:[new BoundDetector()]}).inspect(request(),context())).findings[0].blocking,true);
 for(const blocking of [()=>Promise.resolve(true),()=>undefined,()=>1]) await assert.rejects(defineResultReview({detectors:[detector({blocking})]}).inspect(request(),context()),TypeError);
 assert.throws(()=>defineResultReview({detectors:[detector({blocking:'true'})]}),TypeError);
});
test('generic restored review admission rejects malformed coverage and findings without a recipe decoder',()=>{
 const base={scope:{id:'question',contentRevision:'1',policyRevision:'p1'},findings:[],coverage:[{detectorId:'compare',status:'complete',inspected:['pair'],skipped:[]}]};
 const malformed=[
  {...base,coverage:[{detectorId:'compare',status:'complete',skipped:''}]},
  {...base,coverage:[{detectorId:'compare',status:'complete',inspected:'pair',skipped:[]}]},
  {...base,coverage:[{detectorId:'compare',status:'unknown',inspected:[],skipped:[]}]},
  {...base,coverage:[{detectorId:'compare',status:'complete',inspected:['pair','pair'],skipped:[]}]},
  {...base,coverage:[{detectorId:'compare',status:'partial',inspected:['pair'],skipped:['pair']}]},
  {...base,coverage:[base.coverage[0],base.coverage[0]]},
  {...base,scope:{id:'question',contentRevision:1,policyRevision:'p1'}},
  {...base,findings:[finding({inputIds:[],blocking:false})]},
  {...base,findings:[finding({evidenceIds:'a',blocking:false})]},
  {...base,findings:[finding({kind:'',blocking:false})]},
  {...base,findings:[finding({blocking:false}),finding({blocking:false})]},
  {...base,findings:[{id:'f',state:'suspected',blocking:false}]},
  {...base,coverage:[{detectorId:'compare',status:'complete',inspected:['pair'],skipped:[],reason:42}]},
 ];
 for(const result of malformed) assert.throws(()=>checkReviewAdmission(admission(result)),TypeError);
 const restored=JSON.parse(JSON.stringify(base));assert.equal(checkReviewAdmission(admission(restored)).allowed,true);
});

test('result review validates registration, request bounds and detector plans before evaluation', async () => {
  for (const [definition, error] of [
    [undefined, /Invalid review definition/],
    [{ detectors: [detector({ run: null })] }, /Invalid detector/],
    [{ detectors: [], strategies: [{ id: 'bad' }] }, /Invalid review strategy/],
  ]) assert.throws(() => defineResultReview(definition), error);
  const review = defineResultReview({ detectors: [detector({ run() { assert.fail('invalid request reached detector'); } })] });
  const wrongInput = request();
  wrongInput.inputs[0].versions = null;
  for (const [input, error] of [[{}, /Invalid review request/], [wrongInput, /Invalid source versions/],
    [{ ...request(), maxCandidates: -1 }, /Invalid result review limit/]])
    await assert.rejects(review.inspect(input, context()), error);
  await assert.rejects(defineResultReview({ detectors: [detector({ candidates: async () => [] })] }).inspect(request(), context()),
    /Detector candidates must be synchronous/);
});

test('result review reports incomplete coverage and rejects invalid or duplicate detector findings', async () => {
  const outcome = await defineResultReview({ detectors: [
    detector({ id: 'incomplete', run() { return { findings: [], complete: false }; } }),
    detector({ id: 'unavailable', run() { throw 'detector offline'; } }),
  ] }).inspect(request(), context());
  assert.deepEqual(outcome.coverage.map(c => [c.detectorId, c.status, c.reason, c.skipped]), [
    ['incomplete', 'partial', 'detector-incomplete', ['pair']],
    ['unavailable', 'failed', 'detector-failed', ['pair']],
  ]);
  assert.equal(checkReviewAdmission({ ...admission(outcome), requiredDetectorIds: ['incomplete'] }).allowed, false);
  for (const [findings, error] of [
    [[finding({ state: 'unknown' })], /Invalid review finding/],
    [[finding(), finding()], /Duplicate review finding/],
  ]) await assert.rejects(defineResultReview({ detectors: [
    detector({ run: () => ({ findings, complete: true }) }),
  ] }).inspect(request(), context()), error);
});

test('resolution rejects asynchronous eligibility, malformed output and non-JSON restored structures', async () => {
  const result = await defineResultReview({ detectors: [detector()] }).inspect(request(), context());
  const cases = [
    [{ id: 'lazy', when: async () => true, run() { assert.fail('nonboolean eligibility admitted'); } }, /synchronous booleans/],
    [{ id: 'invalid', when: () => true, run: () => ({ status: 'unknown' }) }, /Invalid review resolution/],
  ];
  for (const [strategy, error] of cases) await assert.rejects(
    defineResultReview({ detectors: [], strategies: [strategy] }).resolve(request(), result, context()), error,
  );
  class Result { constructor(fields) { Object.assign(this, fields); } }
  assert.throws(() => checkReviewAdmission(admission(new Result(result))), /Invalid review result/);
  assert.throws(() => checkReviewAdmission(admission({ ...result, coverage: [...result.coverage, ...result.coverage] })),
    /Duplicate result review references/);
});

test('stored finding and coverage entries must be plain records with valid result states', async () => {
  const result = await defineResultReview({ detectors: [detector()] }).inspect(request(), context());
  for (const malformed of [
    { ...result, scope: null },
    { ...result, findings: {} },
    { ...result, coverage: {} },
  ]) assert.throws(() => checkReviewAdmission(admission(malformed)), /Invalid review result/);
  const [valid] = result.findings;
  class Finding { constructor(value) { Object.assign(this, value); } }
  for (const input of [
    { ...result, findings: [new Finding(valid)] },
    { ...result, findings: [{ ...valid, blocking: 'yes' }] },
    { ...result, findings: [{ ...valid, state: 'unknown' }] },
  ]) assert.throws(() => checkReviewAdmission(admission(input)), /Invalid review finding/);
  for (const row of [null, [], new Finding(result.coverage[0])])
    assert.throws(() => checkReviewAdmission(admission({ ...result, coverage: [row] })), /Invalid review coverage/);
});

test('review admission evaluates the same validated result for the whole decision', async () => {
  const review = defineResultReview({ detectors: [detector()] });
  const result = await review.inspect(request(), context());
  let reads = 0;
  const outcome = checkReviewAdmission({
    ...admission(result),
    get result() { reads++; return reads === 1 ? result : { ...result, findings: [] }; },
  });
  assert.deepEqual(outcome, { allowed: false, reasons: ['blocking:compare:difference'] });
  assert.equal(reads, 1);
});
