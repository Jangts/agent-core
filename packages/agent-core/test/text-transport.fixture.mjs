/**
 * Minimal text-transport fixture implementing the public prepare/collector contract, so
 * tests can exercise ModelRunner text paths without a real provider or adapter. Parsed
 * output comes from the caller-supplied `parse(raw, { stageId })`.
 */
export function textTransport(id, parse, options = {}) {
  return {
    id,
    prepare(stageId) {
      return {
        options,
        // Plain text transports expose no tool schema, so the measured schema size is zero.
        schemaChars: 0,
        createResponse() {
          let raw = '';
          return {
            // Reported output size is the accumulated raw text, not the parsed value.
            get outputChars() {
              return raw.length;
            },
            push(part) {
              // Structured parts must not be silently stringified into a text stream.
              if (typeof part !== 'string') throw new TypeError('Expected text');
              raw += part;
            },
            finish: () => parse(raw, { stageId }),
          };
        },
      };
    },
  };
}
