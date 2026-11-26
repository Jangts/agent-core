/** Read a trusted, side-effect-free App declaration in a fresh process on every export. */
import { pathToFileURL } from 'node:url';
import { fromDefinition } from './snapshot.mjs';

function send(result) {
  process.send(result, () => process.disconnect());
}

let app;
try {
  app = await import(pathToFileURL(process.argv[2]));
} catch {
  // Application exceptions can carry private values. Do not forward them into a report.
  send({
    error: 'Could not import the inspection entry. Check its syntax and module dependencies.',
  });
}

if (app) {
  try {
    const inspection = app.inspection ?? app.default?.inspection;
    const workflow = app.workflow ?? app.default?.workflow;
    send({ snapshot: fromDefinition(inspection ?? { workflow }) });
  } catch (error) {
    send({
      error: error instanceof TypeError ? error.message : 'Could not read the workflow definition',
    });
  }
}
