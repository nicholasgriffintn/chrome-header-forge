import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the manifest declares only the permissions required by current features", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../manifest.json", import.meta.url), "utf8"),
  );

  assert.deepEqual(manifest.permissions, ["storage", "declarativeNetRequest"]);
  assert.deepEqual(manifest.host_permissions, ["<all_urls>"]);
});

test("the website delegates extension packaging to the root package script", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  const websitePackageJson = JSON.parse(
    await readFile(new URL("../website/package.json", import.meta.url), "utf8"),
  );

  assert.match(packageJson.scripts.package, /^zip -FS -r header-forge[.]zip /);
  assert.match(packageJson.scripts.package, /\bmanifest[.]json\b/);
  assert.match(packageJson.scripts.package, /\bpackage[.]json\b/);
  assert.match(websitePackageJson.scripts.prebuild, /pnpm --dir [.][.] run package/);
  assert.match(
    websitePackageJson.scripts.prebuild,
    /cp [.][.]\/header-forge[.]zip public\/header-forge[.]zip/,
  );
  assert.doesNotMatch(websitePackageJson.scripts.prebuild, /\bzip -FS\b/);
});
