import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [html, css] = await Promise.all([
  readFile(new URL("../popup.html", import.meta.url), "utf8"),
  readFile(new URL("../popup.css", import.meta.url), "utf8"),
]);

test("transient status does not compete with file actions for footer width", () => {
  const draftActions = html.slice(
    html.indexOf('<div class="draft-actions">'),
    html.indexOf("<footer>"),
  );
  const footer = html.slice(html.indexOf("<footer>"), html.indexOf("</footer>"));

  assert.match(draftActions, /class="draft-message"/);
  assert.match(draftActions, /id="status"/);
  assert.doesNotMatch(footer, /id="status"/);
});

test("action labels retain stable compact single-line controls", () => {
  assert.match(css, /footer\s*\{[^}]*display:\s*grid/s);
  assert.match(css, /[.]file-actions\s*\{[^}]*display:\s*flex/s);
  assert.match(
    css,
    /[.]import-button,\s*[.]export-button\s*\{[^}]*width:\s*auto[^}]*min-width:\s*112px[^}]*white-space:\s*nowrap/s,
  );
  assert.match(css, /[.]menu-chevron\s*\{[^}]*margin-left:\s*0/s);
  assert.match(css, /#apply\s*\{[^}]*min-width:\s*100px/s);
});

test("export choices explain their security trade-off inside one menu", () => {
  const footer = html.slice(html.indexOf("<footer>"), html.indexOf("</footer>"));

  assert.match(footer, /<details id="export-menu"/);
  assert.match(footer, />\s*Export…\s*</);
  assert.match(footer, /<strong>Redacted copy<\/strong>/);
  assert.match(footer, /Hides tokens and secrets\. Safer to share\./);
  assert.match(footer, /<strong>Full backup<\/strong>/);
  assert.match(footer, /Keeps every value for a complete restore\./);
  assert.match(
    css,
    /[.]export-options button:hover,\s*[.]export-options button:focus-visible\s*\{[^}]*background:\s*var\(--surface-hover\)/s,
  );
});
