/** One executable Tool declaration supplies both model and execution contracts. */
import { Support } from '@jangts/agent-core';
import { toolDefinitions } from './tools.mjs';

export function associatedConfiguration() {
  const execution = Support.defineToolCatalog(toolDefinitions());
  return { execution, tools: execution.tools };
}
