/** Build a portable, self-contained HTML report from validated inspection records. */
import { readFile } from 'node:fs/promises';

const template = await readFile(new URL('./viewer.html', import.meta.url), 'utf8');
const marker = '__WORKFLOW_SNAPSHOT_JSON__';

export function render(report, live = false) {
  // The HTML parser recognizes closing script tags even in application/json blocks.
  const data = JSON.stringify({ ...report, live }).replace(
    /[<>&\u2028\u2029]/g,
    (char) => '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0'),
  );
  return template.replace(marker, () => data);
}
