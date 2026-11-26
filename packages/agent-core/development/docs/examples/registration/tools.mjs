/** Tutorial tools: public in-memory notes only; no application database or network access. */
import { Support } from '@jangts/agent-core';

// The two business inputs differ; the model must use the selected tool's schema.
export function textInput(field) {
  return Support.defineSchema({
    jsonSchema: {
      type: 'object',
      properties: { [field]: { type: 'string', minLength: 1 } },
      required: [field],
      additionalProperties: false,
    },
    parse(value) {
      if (
        !value ||
        typeof value !== 'object' ||
        Array.isArray(value) ||
        Object.keys(value).length !== 1 ||
        typeof value[field] !== 'string' ||
        !value[field].trim()
      ) {
        throw new TypeError(`Expected one nonempty string: ${field}`);
      }
      return { [field]: value[field].trim() };
    },
  });
}

const notes = [{ id: 'n1', title: '咖啡烘焙', body: '烘焙程度可结合豆色和风味判断。' }];

/** Build fresh declarations so manual and associated examples share no mutable request state. */
export function toolDefinitions() {
  return [
    {
      id: 'search_notes',
      asIntent: '用户希望查找笔记',
      kind: 'read',
      description: '按主题检索公开笔记',
      inputSchema: textInput('query'),
      authorize() {}, // This tutorial uses public constants, with no private account data.
      execute({ query }) {
        return notes
          .filter((note) => note.title.includes(query))
          .map(({ id, title }) => ({ id, title }));
      },
      parseOutput(value) {
        if (
          !Array.isArray(value) ||
          value.some((note) => typeof note?.id !== 'string' || typeof note.title !== 'string')
        ) {
          throw new TypeError('Invalid search result');
        }
        return value;
      },
    },
    {
      id: 'read_note',
      kind: 'read',
      description: '读取已定位笔记的正文',
      inputSchema: textInput('noteId'),
      authorize() {},
      execute({ noteId }) {
        const note = notes.find((note) => note.id === noteId);
        if (!note) throw new Error('Note not found');
        return { ...note };
      },
      parseOutput(value) {
        if (!value || typeof value.body !== 'string') {
          throw new TypeError('Invalid note body');
        }
        return value;
      },
    },
  ];
}
