import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const redirects = fs.readFileSync(new URL("../_redirects", import.meta.url), "utf8");

test("short Instagram bio links keep stable Dalli attribution", () => {
  assert.match(
    redirects,
    /^\/i \/\?utm_source=instagram&utm_medium=organic_social&utm_campaign=dalli_bio&utm_content=profile_header 302$/m,
  );
  assert.match(
    redirects,
    /^\/d \/\?utm_source=instagram&utm_medium=organic_social&utm_campaign=dalli_bio&utm_content=profile_header 302$/m,
  );
});
