/**
 * Transport helpers for hosts that own their own HTTP response lifecycle.
 *
 * `./sse.js` covers server-sent events (reading, encoding and cancellable writes) and
 * `./json.js` covers framed JSON scanning. Both are mechanical utilities: the host decides which
 * traffic, frames and content are acceptable.
 */
export * from './sse.js';
export * from './json.js';
