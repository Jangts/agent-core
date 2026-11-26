import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source = `
import { defineResultReview, checkReviewAdmission, type ResultReviewRequest } from '@jangts/agent-core/kits/result-review';
type Report = { answer: string; businessExtension: number };
type App = { owner: string };
const review = defineResultReview<Report, App>({detectors:[{
 id:'compare', candidates(request) { const n: number = request.inputs[0].value.businessExtension; return [{id:String(n),inputIds:['a']}]; },
 run(candidate, request, context) { const owner: string = context.app.owner; const answer: string = request.inputs[0].value.answer; return {findings:[],complete:true}; }
}]});
declare const request: ResultReviewRequest<Report>;
// @ts-expect-error Business report type is retained.
const wrong: number = request.inputs[0].value.answer;
// @ts-expect-error Scope binding is mandatory for admission.
checkReviewAdmission({result:{scope:request.scope,findings:[],coverage:[]},requiredDetectorIds:[],contentRevision:'1',policyRevision:'1'});
// @ts-expect-error An arbitrary model resolution is not an admission option.
checkReviewAdmission({result:{scope:request.scope,findings:[],coverage:[]},requiredDetectorIds:[],scopeId:'s',contentRevision:'1',policyRevision:'1',approved:true});
void [review,wrong];
`;
test('result review preserves business types and keeps explicit admission constraints', () => {
  const options = {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2023,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    types: [],
    lib: ['lib.es2023.d.ts', 'lib.dom.d.ts'],
  };
  // Compile the same source once per module format so neither `.d.mts` nor
  // `.d.cts` declarations silently lose a rejection.
  for (const extension of ['mts', 'cts']) {
    const filename = new URL(`./result-review-types.fixture.${extension}`, import.meta.url)
      .pathname;
    const host = ts.createCompilerHost(options);
    const exists = host.fileExists.bind(host),
      read = host.readFile.bind(host),
      get = host.getSourceFile.bind(host);
    host.fileExists = (path) => path === filename || exists(path);
    host.readFile = (path) => (path === filename ? source : read(path));
    host.getSourceFile = (path, languageVersion, onError, shouldCreateNewSourceFile) =>
      path === filename
        ? ts.createSourceFile(path, source, languageVersion, true)
        : get(path, languageVersion, onError, shouldCreateNewSourceFile);
    const program = ts.createProgram([filename], options, host);
    const errors = ts
      .getPreEmitDiagnostics(program)
      .filter((item) => item.category === ts.DiagnosticCategory.Error);
    // Zero errors includes "unused @ts-expect-error", so a revived legacy API
    // fails here as loudly as a broken current one.
    assert.deepEqual(
      errors.map((error) => ts.flattenDiagnosticMessageText(error.messageText, '\n')),
      [],
      extension,
    );
  }
});
