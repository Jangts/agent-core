import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM, VirtualConsole } from 'jsdom';
import { defineWorkflow } from '@jangts/agent-core';
import { render } from '../development/scripts/workflow-inspector/report.mjs';
import { project, validate } from '../development/scripts/workflow-inspector/snapshot.mjs';
import { describeEvidence } from '../development/scripts/workflow-inspector/evidence.mjs';

test('tall branched graphs reveal the selected node on load, navigation, reset and zoom', () => {
  const workflow = defineWorkflow({ id: 'tall', nodes: [
    { id: 'entry', description: 'Entry', routes: [{ targetNodeId: 'dispatch' }] },
    { id: 'dispatch', description: 'Select a branch', routes: Array.from({ length: 12 }, (_, i) => ({ targetNodeId: `branch-${i}`, when: () => true })) },
    ...Array.from({ length: 12 }, (_, i) => ({ id: `branch-${i}`, description: 'Branched work', routes: [{ complete: () => 'done' }] })),
  ] });
  const snapshot = project(workflow.toGraph());
  const errors = [], console = new VirtualConsole();
  console.on('jsdomError', error => errors.push(error));
  const dom = new JSDOM(render({ snapshot, warnings: validate(snapshot), evidence: describeEvidence(snapshot) }), {
    runScripts: 'dangerously', url: 'file:///workflow.html', virtualConsole: console,
    beforeParse(window) {
      Object.defineProperties(window.HTMLElement.prototype, {
        clientWidth: { configurable: true, get() { return this.id === 'viewport' ? 900 : 0; } },
        clientHeight: { configurable: true, get() { return this.id === 'viewport' ? 720 : 0; } },
      });
    },
  });
  try {
    const document = dom.window.document, viewport = document.getElementById('viewport');
    const visible = () => {
      const node = document.querySelector('#graph .node.selected');
      assert.ok(node, 'The real viewer script must create a selected SVG node');
      const [, x, y] = node.getAttribute('transform').match(/translate\(([-\d.]+),([-\d.]+)\)/);
      const graph = document.getElementById('graph');
      const viewWidth = Number(graph.getAttribute('viewBox').split(' ')[2]);
      const scale = parseFloat(graph.style.width) / viewWidth;
      assert.ok(Number(x) * scale >= viewport.scrollLeft);
      assert.ok((Number(x) + 220) * scale <= viewport.scrollLeft + viewport.clientWidth);
      assert.ok(Number(y) * scale >= viewport.scrollTop);
      assert.ok((Number(y) + 68) * scale <= viewport.scrollTop + viewport.clientHeight);
    };
    assert.equal(document.querySelectorAll('#graph .node').length, 14);
    assert.ok(viewport.scrollTop > 0, 'Entry below the initial scrollport must be brought into view');
    visible();
    document.querySelector('[aria-label="branch-11"]').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    visible();
    viewport.scrollTop = 0;
    document.getElementById('reset').click();
    visible();
    document.getElementById('plus').click();
    visible();
    document.getElementById('minus').click();
    visible();
    viewport.scrollTop = 0;
    dom.window.dispatchEvent(new dom.window.Event('resize'));
    visible();
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});
