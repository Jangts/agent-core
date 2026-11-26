/** A name/input envelope changes model output format while preserving the same tool proposal. */
import { Support } from '@jangts/agent-core';

export function wrappedConfiguration(configuration) {
  const capability = {
    id: 'tool_request',
    description: '提交工具名称和参数，由程序执行',
    inputSchema: Support.defineSchema({
      jsonSchema: {
        type: 'object',
        required: ['name', 'input'],
        additionalProperties: false,
        properties: {
          name: { type: 'string', enum: configuration.tools.ids() },
          input: { type: 'object' },
        },
        anyOf: configuration.tools.definitions.map((tool) => ({
          properties: {
            name: { const: tool.id },
            input: tool.inputSchema.jsonSchema,
          },
        })),
      },
      parse(value) {
        if (
          !value ||
          typeof value !== 'object' ||
          Array.isArray(value) ||
          Object.keys(value).some((key) => key !== 'name' && key !== 'input') ||
          typeof value.name !== 'string' ||
          !value.input ||
          typeof value.input !== 'object' ||
          Array.isArray(value.input)
        ) {
          throw new TypeError('Expected { name, input }');
        }
        configuration.tools.require(value.name);
        return value;
      },
    }),
    resolve: ({ name, input }) => ({ toolId: name, input }),
  };
  return {
    ...configuration,
    tools: Support.defineModelTools([capability]),
    candidateIds: ['tool_request'],
  };
}
