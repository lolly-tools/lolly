// SPDX-License-Identifier: MPL-2.0
// Shared HTML-escape helper for the web shell. Escapes the five characters that
// are unsafe in HTML text content and single/double-quoted attributes, with a
// null/undefined guard. `utils.ts`'s `escape` is the single implementation;
// this is a re-export under the name most of src/lib and src/views already
// import, consolidating the byte-identical copy that used to live here. (The
// /pro subtree keeps its own isolated copy by design and must not import from here.)
export { escape as escapeHtml } from '../utils.ts';
