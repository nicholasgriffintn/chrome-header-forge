import { buildRules, getStateConfigurationError } from "./lib/rules.mjs";
import {
  createDefaultState,
  getStateError,
  normaliseState,
  STORAGE_KEY,
  validateState
} from "./lib/state.mjs";

let rebuildRequested = false;
let rebuildTask;
let requestedState;

chrome.runtime.onInstalled.addListener(() => {
  initialise().catch(reportError);
});

chrome.runtime.onStartup.addListener(() => {
  scheduleRebuild().catch(reportError);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[STORAGE_KEY]) {
    scheduleRebuild(changes[STORAGE_KEY].newValue).catch(reportError);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "APPLY_STATE") {
    applyState(message.state)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: getErrorMessage(error) }));
    return true;
  }
  if (message?.type !== "REBUILD_RULES") return;

  scheduleRebuild()
    .then((result) => sendResponse({ ok: true, ...result }))
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

function scheduleRebuild(state) {
  if (state !== undefined) requestedState = state;
  rebuildRequested = true;
  if (!rebuildTask) {
    rebuildTask = drainRebuilds().finally(() => {
      rebuildTask = undefined;
    });
  }
  return rebuildTask;
}

async function drainRebuilds() {
  let result;
  while (rebuildRequested) {
    rebuildRequested = false;
    const state = requestedState;
    requestedState = undefined;
    result = await rebuildRules(state);
  }
  return result;
}

async function rebuildRules(requestedValue) {
  const stored = requestedValue === undefined
    ? await chrome.storage.local.get(STORAGE_KEY)
    : { [STORAGE_KEY]: requestedValue };
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
  return { state, ruleCount: addRules.length };
}

async function applyState(value) {
  const stateError = getStateError(value);
  const configurationError = stateError ? "" : getStateConfigurationError(value);
  if (stateError || configurationError) {
    throw new Error(stateError || configurationError);
  }
  const state = normaliseState(value);
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const previousState = normaliseState(stored[STORAGE_KEY]);
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
  try {
    return await scheduleRebuild(state);
  } catch (error) {
    await chrome.storage.local.set({ [STORAGE_KEY]: previousState });
    try {
      await scheduleRebuild(previousState);
    } catch (rollbackError) {
      throw new Error(
        `${getErrorMessage(error)}; rollback failed: ${getErrorMessage(rollbackError)}`
      );
    }
    throw error;
  }
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
