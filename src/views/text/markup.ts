// SPDX-License-Identifier: MPL-2.0
import { icon, type IconName } from '../../lib/icons.ts';
import { escapeHtml } from '../../lib/html.ts';
import { SYNTAX_LANGUAGES } from '../../../../../engine/src/text-syntax.ts';
const glyph = (name: IconName): string => icon(name, { className: 'text-icon' });
const button = (hook: string, name: IconName, label: string, extra = ''): string =>
  `<button type="button" class="btn ${extra}" ${hook}>${glyph(name)}<span>${label}</span></button>`;
export function workspaceMarkup(id: string): string {
  return `<header class="text-heading"><div><h1>Text</h1><p>Characters, words and code. Make them work for you.</p></div><div data-privacy></div></header>
    <div class="text-navigation"><div class="text-tabs" role="tablist" aria-label="Text workspace">
      <button type="button" role="tab" id="${id}-characters-tab" aria-controls="${id}-characters" aria-selected="true" data-mode="characters">${glyph('font')}<span>Characters &amp; emoji</span></button>
      <button type="button" role="tab" id="${id}-text-tab" aria-controls="${id}-text" aria-selected="false" tabindex="-1" data-mode="text">${glyph('pen')}<span>Write &amp; edit</span></button>
    </div>${button('data-all', 'search', 'Find an action', 'btn--ghost text-action-search')}</div>
    <section id="${id}-characters" role="tabpanel" aria-labelledby="${id}-characters-tab" data-characters hidden></section>
    <section id="${id}-text" role="tabpanel" aria-labelledby="${id}-text-tab" data-document hidden>
      <div class="text-document-toolbar"><div class="text-document-name">${glyph('document')}<div><strong data-source>Untitled text</strong><span data-history-status class="text-muted">Your draft stays on this device</span></div></div><div class="text-row">
        ${button('data-open-menu aria-haspopup="menu"', 'folder', 'Open', 'btn--ghost')}
        ${button('data-save', 'check', 'Save', 'btn--primary')}
        ${button('data-copy', 'duplicate', 'Copy', 'btn--ghost')}
        ${button('data-document-menu aria-label="More document actions" title="More document actions" aria-haspopup="menu"', 'menuDots', '', 'btn--ghost text-icon-button')}
      </div></div>
      <div class="text-action-bar"><div class="text-row" data-suggestions></div><div class="text-row"><span class="text-scope" data-scope></span>${button('data-selection-actions aria-haspopup="menu" hidden', 'font', 'Selection actions', 'btn--ghost')}</div></div>
      <div class="text-status-row" data-status-row hidden><p data-status role="status" aria-live="polite"></p>${button('data-cancel hidden', 'close', 'Cancel', 'btn--ghost')}</div>
      <div class="text-tabs text-result-tabs" role="tablist" aria-label="Editor and result" data-result-tabs hidden>
        <button type="button" role="tab" id="${id}-editor-tab" data-result-view="text" aria-controls="${id}-editor" aria-selected="true">${glyph('pen')}Text</button>
        <button type="button" role="tab" id="${id}-result-tab" data-result-view="result" aria-controls="${id}-result" aria-selected="false" tabindex="-1">${glyph('eye')}Result</button>
      </div>
      <div class="text-work-area"><section class="text-editor-panel" id="${id}-editor" data-editor-pane role="tabpanel" aria-labelledby="${id}-editor-tab">
        <div class="text-editor-tools"><span class="text-muted">Your text</span><div class="text-row"><label class="text-language">Syntax <select data-language aria-label="Syntax language"><option value="auto">Automatic</option>${SYNTAX_LANGUAGES.map((lang) => `<option value="${escapeHtml(lang)}">${lang === 'plain' ? 'Plain text' : escapeHtml(lang)}</option>`).join('')}</select></label><label class="text-wrap"><input type="checkbox" data-wrap checked> Wrap</label></div></div>
        <div data-editor></div>
        <div class="text-empty-help" data-empty-help><p>Paste or type above to get started.</p><div class="text-row">${button('data-paste', 'clipboard', 'Paste text', 'btn--primary')}${button('data-open', 'upload', 'Open file', 'btn--ghost')}${button('data-catalog', 'grid', 'Catalog', 'btn--ghost')}</div><div class="text-samples"><span>Or try a sample</span>${button('data-sample="writing"', 'document', 'Writing', 'btn--ghost')}${button('data-sample="json"', 'code', 'JSON', 'btn--ghost')}${button('data-sample="logs"', 'checklist', 'Logs', 'btn--ghost')}</div></div>
        <footer class="text-editor-footer"><span data-facts class="text-muted"></span><div class="text-row">${button('data-undo aria-label="Undo" title="Undo (Ctrl/Cmd+Z)"', 'undo', '', 'btn--ghost text-icon-button')}${button('data-redo aria-label="Redo" title="Redo (Ctrl/Cmd+Shift+Z)"', 'redo', '', 'btn--ghost text-icon-button')}</div></footer>
      </section>
      <section class="text-result" id="${id}-result" data-result hidden role="tabpanel" aria-labelledby="${id}-result-tab">
        <header class="text-result-header"><div class="text-row"><span data-result-icon></span><div><h2 tabindex="-1" data-result-title>Result</h2><p data-result-scope class="text-muted"></p></div></div>${button('data-dismiss-result aria-label="Close result" title="Close result"', 'close', '', 'btn--ghost text-icon-button')}</header>
        <div class="text-result-body"><p data-result-notes class="text-muted"></p><div data-result-extra></div><pre class="syntax" data-result-text tabindex="0" aria-label="Result text"></pre></div>
        <footer class="text-result-footer"><div class="text-row">${button('data-apply', 'check', 'Replace selection', 'btn--primary')}${button('data-copy-result', 'duplicate', 'Copy result', 'btn--ghost')}</div><div class="text-row">${button('data-adjust', 'sliders', 'Adjust', 'btn--ghost')}${button('data-result-menu aria-label="More result actions" title="More result actions" aria-haspopup="menu"', 'menuDots', '', 'btn--ghost text-icon-button')}</div></footer>
        <button data-insert-result hidden>Insert result</button><button data-save-result hidden>Save result</button><button data-download-result hidden>Download result</button><button data-alias-map hidden>Download alias map</button><button data-ai="explain-logs" hidden data-explain>AI log synopsis</button>
      </section></div>
      <input type="file" data-file hidden><button data-download hidden>Download</button><button data-new hidden>New text</button>
    </section>`;
}
