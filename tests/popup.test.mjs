import assert from "node:assert/strict";
import test from "node:test";

import { createDefaultState, STORAGE_KEY } from "../lib/state.mjs";

test("popup edits start persistence before the event handler returns", async (context) => {
  const document = createDocument();
  const storageWrites = [];
  const originalSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (callback) => {
    queueMicrotask(callback);
    return 0;
  };
  context.after(() => {
    globalThis.setTimeout = originalSetTimeout;
  });

  globalThis.chrome = {
    runtime: {
      getManifest() {
        return { version: "1.0.0" };
      },
      async sendMessage() {
        return { ok: true };
      }
    },
    storage: {
      local: {
        async get() {
          return { [STORAGE_KEY]: createDefaultState() };
        },
        async set(value) {
          storageWrites.push(structuredClone(value[STORAGE_KEY]));
        }
      }
    }
  };
  globalThis.document = document;

  await import(`../popup.js?test=${Date.now()}`);
  await waitFor(() => document.elements.urlFilter.listeners.input);

  document.elements.urlFilter.value = "||example.com/";
  document.elements.urlFilter.listeners.input();

  assert.equal(storageWrites.length, 1);
  assert.equal(storageWrites[0].profiles[0].urlFilter, "||example.com/");
});

function createDocument() {
  const elements = {
    shell: new FakeElement(),
    enabled: new FakeElement(),
    globalStatus: new FakeElement(),
    activeRuleCount: new FakeElement(),
    activeUrlFilter: new FakeElement(),
    profileSelect: new FakeElement(),
    deleteProfile: new FakeElement(),
    urlFilter: new FakeElement(),
    urlFilterError: new FakeElement(),
    requestHeaders: new FakeElement(),
    responseHeaders: new FakeElement(),
    requestCount: new FakeElement(),
    responseCount: new FakeElement(),
    status: new FakeElement(),
    version: new FakeElement(),
    addProfile: new FakeElement(),
    renameProfile: new FakeElement(),
    deleteProfileButton: new FakeElement(),
    exportButton: new FakeElement(),
    importInput: new FakeElement()
  };
  const addRequest = new FakeElement({ add: "requestHeaders" });
  const addResponse = new FakeElement({ add: "responseHeaders" });
  const selectors = new Map([
    [".app-shell", elements.shell],
    ["#global-enabled", elements.enabled],
    ["#global-status", elements.globalStatus],
    ["#active-rule-count", elements.activeRuleCount],
    ["#active-url-filter", elements.activeUrlFilter],
    ["#profile-select", elements.profileSelect],
    ["#delete-profile", elements.deleteProfile],
    ["#url-filter", elements.urlFilter],
    ["#url-filter-error", elements.urlFilterError],
    ["#request-headers", elements.requestHeaders],
    ["#response-headers", elements.responseHeaders],
    ["#request-count", elements.requestCount],
    ["#response-count", elements.responseCount],
    ["#status", elements.status],
    ["#version", elements.version],
    ["#add-profile", elements.addProfile],
    ["#rename-profile", elements.renameProfile],
    ["#export", elements.exportButton],
    ["#import", elements.importInput]
  ]);
  selectors.set("#header-row-template", {
    content: {
      firstElementChild: {
        cloneNode() {
          return createHeaderRow();
        }
      }
    }
  });

  return {
    elements,
    createElement() {
      return new FakeElement();
    },
    querySelector(selector) {
      return selectors.get(selector);
    },
    querySelectorAll(selector) {
      return selector === "[data-add]" ? [addRequest, addResponse] : [];
    }
  };
}

function createHeaderRow() {
  const row = new FakeElement();
  const children = new Map([
    [".row-enabled", new FakeElement()],
    [".row-operation", new FakeElement()],
    [".row-name", new FakeElement()],
    [".row-value", new FakeElement()],
    [".row-delete", new FakeElement()],
    [".row-error", new FakeElement()]
  ]);
  row.querySelector = (selector) => children.get(selector);
  return row;
}

class FakeElement {
  constructor(dataset = {}) {
    this.classList = { toggle() {} };
    this.dataset = dataset;
    this.files = [];
    this.listeners = {};
    this.textContent = "";
    this.value = "";
  }

  addEventListener(type, listener) {
    this.listeners[type] = listener;
  }

  append() {}
  click() {}
  remove() {}
  replaceChildren() {}
  setAttribute() {}
}

async function waitFor(predicate) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error("Timed out waiting for popup initialisation");
}
