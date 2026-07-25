import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

test("the production build contains the page and extension artefacts", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  const archive = new URL("../dist/header-forge.zip", import.meta.url);
  const archiveContents = execFileSync("unzip", ["-Z1", archive.pathname], {
    encoding: "utf8",
  });

  assert.match(html, /Header Forge — Local HTTP header overrides for Chrome/);
  assert.match(html, /src="[/]assets[/]index-[^"]+[.]js"/);
  assert.ok((await stat(new URL("../dist/icon.svg", import.meta.url))).size > 0);
  assert.ok((await stat(new URL("../dist/header-forge.png", import.meta.url))).size > 0);
  assert.ok((await stat(archive)).size > 0);
  assert.match(archiveContents, /^manifest[.]json$/m);
  assert.match(archiveContents, /^service-worker[.]js$/m);
  assert.match(archiveContents, /^popup[.]html$/m);
  assert.match(archiveContents, /^lib[/]rules[.]mjs$/m);
  assert.match(archiveContents, /^lib[/]state[.]mjs$/m);
});
