// SPDX-License-Identifier: MPL-2.0
// Terminal highlighting for shell fences: what each run is called, that the runs always
// join back to the source, and that nothing in the code reaches the markup.
// Run: node --test packages/docs-render/test/shell-highlight.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codeRunsHtml, isShellLang, shellRuns, type ShellKind } from '../src/index.ts';

/** The runs of one kind, as text. */
function of(code: string, kind: ShellKind): string[] {
  return shellRuns(code).filter((r) => r.kind === kind).map((r) => r.text);
}

const TRICKY = [
  '',
  '\n\n',
  'echo "unclosed',
  "echo don't stop\necho 'later'",
  'a\\',
  '$(',
  '`',
  '<<EOF',
  'cat <<EOF\nbody\n',
  '$((1 + 2))',
  '"$(echo "$(nested)")"',
  'x=1 y=2 cmd --a=b=c -d\'\' "" \'\'',
  '\\\n\\\n',
  '#',
  '$ ',
  '<a><b',
  'cmd >&2 2>&1 &>/dev/null <(other)',
  'for f in *.svg; do lolly convert "$f"; done',
];

test('the runs join back to the exact source, so the page text and Copy are unchanged', () => {
  for (const code of TRICKY) {
    assert.equal(shellRuns(code).map((r) => r.text).join(''), code, JSON.stringify(code));
    const html = codeRunsHtml(shellRuns(code), false);
    const text = html.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    assert.equal(text, code, `html text of ${JSON.stringify(code)}`);
  }
});

test('code cannot reach the markup: every character is escaped and every class is from the list', () => {
  const code = 'echo "<script>alert(1)</script>" \'<img src=x onerror=alert(1)>\' <b>&amp; # <i>\n# </code></pre>';
  for (const wrap of [false, true]) {
    const html = codeRunsHtml(shellRuns(code), wrap);
    assert.ok(!/<(?!\/?span\b)/.test(html), 'only span tags are written');
    for (const m of html.matchAll(/<span class="([^"]*)">/g)) {
      assert.match(m[1]!, /^(doc-code-token|sh-(cmd|flag|key|op|str|var|ph|cont|com|out|prompt))$/);
    }
    assert.ok(html.includes('&lt;script&gt;') && html.includes('&lt;/code&gt;&lt;/pre&gt;'), 'markup in the code is escaped');
  }
});

test('commands, flags, key=value, strings, variables and continuations', () => {
  // A braced variable, written without a template literal's own syntax.
  const braced = ['$', '{TAG}'].join('');
  const code = `helm install lolly-work deploy/helm \\\n  --set image.tag=1.2 -n team "$HOME/x" 'q' ${braced}`;
  assert.deepEqual(of(code, 'cmd'), ['helm']);
  assert.deepEqual(of(code, 'flag'), ['--set', '-n']);
  assert.deepEqual(of(code, 'key'), ['image.tag']);
  assert.deepEqual(of(code, 'var'), ['$HOME', braced]);
  assert.deepEqual(of(code, 'str'), ['"', '/x"', "'q'"]);
  assert.deepEqual(of(code, 'cont'), ['\\']);
});

test('a command follows a pipe, a separator, a prefix or a substitution', () => {
  const code = 'C=$(curl -s x | grep -i y) && sudo python3 -I z; for f in a; do lolly f; done';
  assert.deepEqual(of(code, 'cmd'), ['curl', 'grep', 'sudo', 'python3', 'for', 'do', 'lolly', 'done']);
  assert.deepEqual(of(code, 'key'), ['C'], 'an assignment before a command names a variable');
});

test('a flag with a value splits at its equals sign; the value can be a key=value of its own', () => {
  const code = 'kubectl create secret generic s --from-literal=DATABASE_URL=postgres://h';
  assert.deepEqual(of(code, 'flag'), ['--from-literal']);
  assert.deepEqual(of(code, 'key'), ['DATABASE_URL']);
  assert.deepEqual(of(code, 'op'), ['=', '=']);
});

test('placeholders are marked in arguments and in strings; a redirection is not a placeholder', () => {
  const code = 'docker build -t <registry>/server:1 . > out.log\ncurl "https://<your-host>/admin"';
  assert.deepEqual(of(code, 'ph'), ['<registry>', '<your-host>']);
  assert.ok(of(code, 'op').includes('>'));
});

test('a comment line straight after a command, ending its paragraph, is that command\'s output', () => {
  const code = [
    '# Name the release lolly-work.',
    'curl -s http://localhost:8787/healthz',
    '# {"ok":true}',
    '',
    'kubectl get pods   # wait for Running',
    '# then this one',
    'kubectl logs x',
    'cp a b',
    '# Copying the example resets baseUrl.',
  ].join('\n');
  assert.deepEqual(of(code, 'out'), ['# {"ok":true}']);
  assert.deepEqual(of(code, 'com'), ['# Name the release lolly-work.', '# wait for Running', '# then this one', '# Copying the example resets baseUrl.']);
});

test('a hash inside a word or a string is not a comment', () => {
  const code = "lolly qr --color=#0c322c 'Section #2' x#y";
  assert.deepEqual(of(code, 'com'), []);
});

test('a quote inside a word stays on its line; one that opens a value may span lines', () => {
  assert.deepEqual(of("echo don't\nls 'a'", 'str'), ["'a'"]);
  assert.deepEqual(of("OPTS='{\n  \"a\": 1}'\nlw x", 'str'), ["'{\n  \"a\": 1}'"]);
  assert.deepEqual(of("OPTS='{\n  \"a\": 1}'\nlw x", 'cmd'), ['lw']);
});

test('a here-document body is literal text up to its delimiter', () => {
  const code = "cat > f.yaml <<'YAML'\nservices:\n  server: x\nYAML\ndocker compose up";
  assert.deepEqual(of(code, 'str'), ['services:\n  server: x\n']);
  assert.deepEqual(of(code, 'cmd'), ['cat', 'docker']);
});

test('a transcript marks its prompts, and its other lines are output', () => {
  const code = '$ lolly --version\nlolly 1.2.3\n$ lolly qr \\\n  --url=x';
  assert.deepEqual(of(code, 'prompt'), ['$ ', '$ ']);
  assert.deepEqual(of(code, 'out'), ['lolly 1.2.3']);
  assert.deepEqual(of(code, 'cmd'), ['lolly', 'lolly']);
  assert.deepEqual(of(code, 'flag'), ['--version', '--url']);
});

test('a wrapping block nests the runs inside each held-together argument', () => {
  const html = codeRunsHtml(shellRuns('lolly qr --url="a b"'), true);
  assert.equal(html, [
    '<span class="doc-code-token"><span class="sh-cmd">lolly</span></span>',
    '<span class="doc-code-token">qr</span>',
    '<span class="doc-code-token"><span class="sh-flag">--url</span><span class="sh-op">=</span><span class="sh-str">"a</span></span>',
    '<span class="doc-code-token"><span class="sh-str">b"</span></span>',
  ].join(' '));
});

test('only shell languages are drawn as a terminal', () => {
  for (const lang of ['bash', 'sh', 'shell', 'zsh']) assert.ok(isShellLang(lang), lang);
  for (const lang of ['console', 'text', 'json', 'yaml', '']) assert.ok(!isShellLang(lang), lang);
});
