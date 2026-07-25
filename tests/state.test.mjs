import assert from "node:assert/strict";
import test from "node:test";

import {
  createDefaultState,
  getStateError,
  normaliseState,
  redactStateForExport,
  validateState
} from "../lib/state.mjs";

test("normaliseState repairs malformed rules without crashing", () => {
  const state = normaliseState({
    enabled: true,
    activeProfileId: "profile",
    profiles: [{
      id: "profile",
      name: "Imported",
      urlFilter: "*",
      requestHeaders: [null, { name: "X-Test", value: 42 }],
      responseHeaders: "invalid"
    }]
  });

  assert.deepEqual(state.profiles[0].requestHeaders, [{
    enabled: true,
    operation: "set",
    name: "X-Test",
    value: ""
  }]);
  assert.deepEqual(state.profiles[0].responseHeaders, []);
  assert.equal(validateState(state), true);
});

test("normaliseState selects an existing profile and removes duplicate IDs", () => {
  const state = normaliseState({
    enabled: false,
    activeProfileId: "missing",
    profiles: [
      {
        id: "first",
        name: "First",
        urlFilter: "*",
        requestHeaders: [],
        responseHeaders: []
      },
      {
        id: "first",
        name: "Duplicate",
        urlFilter: "*",
        requestHeaders: [],
        responseHeaders: []
      }
    ]
  });

  assert.equal(state.activeProfileId, "first");
  assert.equal(state.profiles.length, 1);
  assert.equal(state.enabled, false);
});

test("getStateError rejects imports that reference a missing profile", () => {
  const state = createDefaultState();
  state.activeProfileId = "missing";

  assert.equal(getStateError(state), "The active profile does not exist");
  assert.equal(validateState(state), false);
});

test("createDefaultState returns independent state", () => {
  const first = createDefaultState();
  const second = createDefaultState();

  first.profiles[0].name = "Changed";

  assert.equal(second.profiles[0].name, "Default");
});

test("redacted exports remove credential header values without mutating settings", () => {
  const state = createDefaultState();
  state.profiles[0].requestHeaders = [
    { enabled: true, operation: "set", name: "Authorization", value: "Bearer secret" },
    { enabled: true, operation: "set", name: "X-Debug", value: "true" }
  ];

  const exported = redactStateForExport(state);

  assert.equal(exported.profiles[0].requestHeaders[0].value, "[REDACTED]");
  assert.equal(exported.profiles[0].requestHeaders[1].value, "true");
  assert.equal(state.profiles[0].requestHeaders[0].value, "Bearer secret");
});
