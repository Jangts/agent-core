import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

test('Core validation guards do not flatten four independent conditions into one OR chain', () => {
  const failures = [];
  function terms(node) {
    return ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.BarBarToken
      ? terms(node.left) + terms(node.right)
      : 1;
  }
  function scan(file) {
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    function guard(node) {
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
        const parent = node.parent;
        const continuation =
          ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.BarBarToken;
        if (!continuation && terms(node) > 3)
          failures.push(
            `${path.relative(import.meta.dirname, file)}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`,
          );
      }
      ts.forEachChild(node, guard);
    }
    function visit(node) {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'breakWhile' &&
        node.arguments[0]
      )
        guard(node.arguments[0]);
      else ts.forEachChild(node, visit);
    }
    visit(source);
  }
  for (const file of ['domains/registry.ts', 'domains/scopes.ts', 'tools.ts']) {
    scan(path.resolve(import.meta.dirname, '../src/kits', file));
  }
  assert.deepEqual(failures, [], `restore condition/rule groups at ${failures.join(', ')}`);
});

