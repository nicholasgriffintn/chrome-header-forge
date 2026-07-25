import assert from "node:assert/strict";
import test from "node:test";

import { createDefaultState, STORAGE_KEY } from "../lib/state.mjs";

test("the worker serialises rebuilds and finishes with the latest stored state", async () => {
  const listeners = {};
  let storedState = createStateWithHeader("X-First");
  let releaseFirstUpdate;
  let activeUpdates = 0;
  let maximumActiveUpdates = 0;
  const installedRules = [];

  globalThis.chrome = {
    action: {
      async setBadgeBackgroundColor() {},
      async setBadgeText() {}
    },
    declarativeNetRequest: {
      async getDynamicRules() {
        return installedRules.at(-1) ?? [];
      },
      async updateDynamicRules({ addRules }) {
        activeUpdates += 1;
        maximumActiveUpdates = Math.max(maximumActiveUpdates, activeUpdates);
        if (!releaseFirstUpdate) {
          await new Promise((resolve) => {
            releaseFirstUpdate = resolve;
          });
        }
        installedRules.push(addRules);
        activeUpdates -= 1;
      }
    },
    runtime: {
      onInstalled: captureListener(listeners, "installed"),
      onMessage: captureListener(listeners, "message"),
      onStartup: captureListener(listeners, "startup")
    },
    storage: {
      local: {
        async get() {
          return { [STORAGE_KEY]: structuredClone(storedState) };
        },
        async set(value) {
          storedState = structuredClone(value[STORAGE_KEY]);
        },
        async setAccessLevel() {}
      },
      onChanged: captureListener(listeners, "storage")
    }
  };

  await import(`../service-worker.js?test=${Date.now()}`);

  const firstRebuild = sendRebuildMessage(listeners.message);
  await waitFor(() => releaseFirstUpdate);

  storedState = createStateWithHeader("X-Latest");
  listeners.storage({ [STORAGE_KEY]: { newValue: storedState } }, "local");
  releaseFirstUpdate();
  await firstRebuild;

  assert.equal(maximumActiveUpdates, 1);
  assert.equal(installedRules.at(-1)[0].action.requestHeaders[0].header, "X-Latest");
});

function captureListener(listeners, key) {
  return {
    addListener(listener) {
      listeners[key] = listener;
    }
  };
}

function createStateWithHeader(name) {
  const state = createDefaultState();
  state.profiles[0].requestHeaders = [
    { enabled: true, operation: "set", name, value: "value" }
  ];
  return state;
}

function sendRebuildMessage(listener) {
  return new Promise((resolve, reject) => {
    const handledAsynchronously = listener({ type: "REBUILD_RULES" }, {}, (response) => {
      if (response.ok) resolve();
      else reject(new Error(response.error));
    });
    assert.equal(handledAsynchronously, true);
  });
}

async function waitFor(predicate) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error("Timed out waiting for the worker update");
}
