import { buildRules } from "./lib/rules.mjs";
import {
  createDefaultState,
  normaliseState,
  STORAGE_KEY,
  validateState
} from "./lib/state.mjs";

let rebuildRequested = false;
let rebuildTask;

chrome.runtime.onInstalled.addListener(() => {
  initialise().catch(reportError);
});

chrome.runtime.onStartup.addListener(() => {
  scheduleRebuild().catch(reportError);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[STORAGE_KEY]) {
    scheduleRebuild().catch(reportError);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "REBUILD_RULES") return;

  scheduleRebuild()
    .then(() => sendResponse({ ok: true }))
    .catch((error) => sendResponse({ ok: false, error: getErrorMessage(error) }));

  return true;
});

async function initialise() {
  await chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  if (!stored[STORAGE_KEY]) {
    await chrome.storage.local.set({ [STORAGE_KEY]: createDefaultState() });
  }
  await scheduleRebuild();
}

function scheduleRebuild() {
  rebuildRequested = true;
  if (!rebuildTask) {
    rebuildTask = drainRebuilds().finally(() => {
      rebuildTask = undefined;
    });
  }
  return rebuildTask;
}

async function drainRebuilds() {
  while (rebuildRequested) {
    rebuildRequested = false;
    await rebuildRules();
  }
}

async function rebuildRules() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const state = normaliseState(stored[STORAGE_KEY]);
  if (!validateState(stored[STORAGE_KEY])) {
    await chrome.storage.local.set({ [STORAGE_KEY]: state });
  }
  const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = oldRules.map((rule) => rule.id);

  const addRules = state.enabled ? buildRules(state) : [];

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules
  });

  await updateBadge(state, addRules.length);
}

async function updateBadge(state, ruleCount) {
  const active = state.enabled && ruleCount > 0;
  await chrome.action.setBadgeText({ text: active ? "ON" : "" });
  await chrome.action.setBadgeBackgroundColor({ color: active ? "#2563eb" : "#64748b" });
}

function reportError(error) {
  console.error("Header Forge could not rebuild its rules:", error);
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
