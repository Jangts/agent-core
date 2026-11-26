/**
 * Text Blocks Kit: structure-aware splitting for long plain text.
 *
 * Place in the package: an optional App-side helper used before a long document is paged
 * into a model or indexed for retrieval. The Kit owns boundary selection, block numbering
 * and exact reassembly; file reading, paging, search, storage and prompt wording stay with
 * the App. No model call or Core dependency is involved.
 *
 * Exports: `splitTextBlocks`, `TextBlocks` and the block option/result types.
 */
import { breakWhile } from '../utils/rules.js';
import type { TextBlock, TextBlockOptions } from '../structs/kits/text-blocks.js';

/**
 * Whether one line starts a new structural section.
 *
 * @param line - A full line including its trailing newline.
 * @returns `true` for Markdown headings and horizontal rules.
 */
function headingLine(line: string): boolean {
  return /^\s*#{1,6}\s/.test(line) || /^\s*(?:[-*_]{3,}|={3,})\s*$/.test(line);
}

/**
 * Split long plain text on structural boundaries.
 *
 * Headings and horizontal rules start a new block, blank lines end the current one, and all
 * other lines break only when the target size would be exceeded. A single line longer than
 * the target becomes its own block so that paging can cut it into fragments later without
 * splitting the line into unrelated sections. Concatenating every block reproduces the input
 * exactly: no truncation, padding or dropped whitespace.
 *
 * The input must be plain text; binaries and rich documents are read elsewhere.
 *
 * @param text - Decoded source text.
 * @param options - Target block size in characters.
 * @returns Blocks in source order, each with one-based `number` and source offsets. Empty
 *   text returns an empty list.
 * @throws TypeError When the text is not a string or `targetChars` is not a positive integer.
 */
export function splitTextBlocks(text: string, options: TextBlockOptions): TextBlock[] {
  breakWhile(
    typeof text !== 'string' ||
      !options ||
      !Number.isSafeInteger(options.targetChars) ||
      options.targetChars < 1,
    'Text block splitting requires text and a positive integer target size',
  );
  const targetChars = options.targetChars;
  const blocks: TextBlock[] = [];
  let buffer = '';
  let bufferStart = 0;
  let cursor = 0;
  const flush = () => {
    if (!buffer) return;
    const previous = blocks.at(-1);
    if (!buffer.trim() && previous) {
      // Whitespace-only blocks carry no section, so they stay attached to the previous block
      // instead of becoming a block the reader has to page through.
      blocks[blocks.length - 1] = {
        ...previous,
        text: previous.text + buffer,
        end: previous.end + buffer.length,
      };
    } else {
      blocks.push({ number: blocks.length + 1, text: buffer, start: bufferStart, end: cursor });
    }
    buffer = '';
  };
  // Keeping a line's trailing newline makes every block reassemble into the original text,
  // including CRLF input.
  for (const line of text.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
    if (line.length > targetChars) {
      flush();
      blocks.push({
        number: blocks.length + 1,
        text: line,
        start: cursor,
        end: cursor + line.length,
      });
      cursor += line.length;
      continue;
    }
    if (headingLine(line)) flush();
    if (buffer.length + line.length > targetChars) flush();
    if (!buffer) bufferStart = cursor;
    buffer += line;
    cursor += line.length;
    if ((!line.trim() || headingLine(line)) && buffer.length >= targetChars / 2) flush();
    else if (buffer.length >= targetChars) flush();
  }
  flush();
  return blocks;
}

/** Namespace form of the Kit, for callers that prefer one aggregate entry. */
export const TextBlocks = { split: splitTextBlocks } as const;

export type { TextBlock, TextBlockOptions } from '../structs/kits/text-blocks.js';
