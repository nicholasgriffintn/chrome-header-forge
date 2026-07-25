import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRules,
  countApplicableHeaders,
  getHeaderError,
  getStateConfigurationError,
  getUrlFilterError,
  normaliseUrlFilter
} from "../lib/rules.mjs";
import { createDefaultState } from "../lib/state.mjs";

test("buildRules includes set, remove, and append operations", () => {
  const state = createDefaultState();
  const profile = state.profiles[0];
  profile.requestHeaders = [
    { enabled: true, operation: "append", name: "Cookie", value: "preview=true" },
    { enabled: true, operation: "remove", name: "X-Legacy", value: "ignored" }
  ];
  profile.responseHeaders = [
    { enabled: true, operation: "append", name: "Vary", value: "Origin" }
  ];

  const [rule] = buildRules(state);

  assert.deepEqual(rule.action.requestHeaders, [
    { header: "cookie", operation: "append", value: "preview=true" },
    { header: "X-Legacy", operation: "remove" }
  ]);
  assert.deepEqual(rule.action.responseHeaders, [
    { header: "Vary", operation: "append", value: "Origin" }
  ]);
});

test("unsupported request append operations remain inactive", () => {
  const header = { enabled: true, operation: "append", name: "X-Custom", value: "one" };
  const state = createDefaultState();
  state.profiles[0].requestHeaders = [header];

  assert.equal(getHeaderError(header, "requestHeaders"), "Chrome cannot append to this request header");
  assert.equal(countApplicableHeaders([header], "requestHeaders"), 0);
  assert.deepEqual(buildRules(state), []);
});

test("invalid header values remain inactive", () => {
  const header = { enabled: true, operation: "set", name: "X-Test", value: "one\r\ntwo" };
  const state = createDefaultState();
  state.profiles[0].requestHeaders = [header];

  assert.equal(getHeaderError(header, "requestHeaders"), "Header values cannot contain line breaks");
  assert.deepEqual(buildRules(state), []);
});

test("invalid URL filters disable a profile's rules", () => {
  const state = createDefaultState();
  state.profiles[0].urlFilter = "https://éxample.com";
  state.profiles[0].responseHeaders = [
    { enabled: true, operation: "set", name: "X-Test", value: "one" }
  ];

  assert.equal(getUrlFilterError(state.profiles[0].urlFilter), "URL filters must use printable ASCII characters");
  assert.deepEqual(buildRules(state), []);
});

test("invalid URL filter anchors are rejected before Chrome sees them", () => {
  assert.equal(getUrlFilterError("||*example.com"), "Use * instead of a ||* URL filter");
  assert.equal(getUrlFilterError("||"), "URL filter needs a pattern");
  assert.equal(
    getUrlFilterError("example|test"),
    "URL filter anchors can only appear at the beginning or end"
  );
});

test("semantic rule errors reject otherwise well-formed imports", () => {
  const state = createDefaultState();
  state.profiles[0].requestHeaders = [
    { enabled: true, operation: "append", name: "X-Custom", value: "one" }
  ];

  assert.equal(
    getStateConfigurationError(state),
    "Profile “Default”, header “X-Custom”: Chrome cannot append to this request header"
  );
});

test("disabled rules remain portable even when Chrome cannot apply them", () => {
  const state = createDefaultState();
  state.profiles[0].requestHeaders = [
    { enabled: false, operation: "append", name: "X-Custom", value: "one" }
  ];

  assert.equal(getStateConfigurationError(state), "");
});

test("wildcard URL filters target HTTP and HTTPS", () => {
  assert.equal(normaliseUrlFilter("*"), "|http");
  assert.equal(normaliseUrlFilter("  "), "|http");
  assert.equal(normaliseUrlFilter(" ||example.com/ "), "||example.com/");
});
