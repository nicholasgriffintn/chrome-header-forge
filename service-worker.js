const STORAGE_KEY = "headerForgeState"; // allow-secret

const DEFAULT_STATE = {
  enabled: true,
  activeProfileId: "default",
  profiles: [
    {
      id: "default",
      name: "Default",
      urlFilter: "*",
      requestHeaders: [],
      responseHeaders: []
    }
  ]
};

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  if (!stored[STORAGE_KEY]) {
    await chrome.storage.local.set({ [STORAGE_KEY]: DEFAULT_STATE });
  }
  await rebuildRules();
});

chrome.runtime.onStartup.addListener(rebuildRules);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "REBUILD_RULES") return;

  rebuildRules()
    .then(() => sendResponse({ ok: true }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});

async function rebuildRules() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const state = normaliseState(stored[STORAGE_KEY]);
  const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = oldRules.map((rule) => rule.id);

  const addRules = state.enabled ? buildRules(state) : [];

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules
  });

  await updateBadge(state, addRules.length);
}

function normaliseState(value) {
  if (
    value &&
    typeof value.enabled === "boolean" &&
    typeof value.activeProfileId === "string" &&
    Array.isArray(value.profiles) &&
    value.profiles.length
  ) {
    const profiles = value.profiles
      .filter((profile) =>
        profile &&
        typeof profile.id === "string" &&
        typeof profile.name === "string"
      )
      .map((profile) => ({
        id: profile.id,
        name: profile.name,
        urlFilter: typeof profile.urlFilter === "string" ? profile.urlFilter : "*",
        requestHeaders: Array.isArray(profile.requestHeaders) ? profile.requestHeaders : [],
        responseHeaders: Array.isArray(profile.responseHeaders) ? profile.responseHeaders : []
      }));

    if (profiles.length) {
      const activeProfileId = profiles.some((profile) => profile.id === value.activeProfileId)
        ? value.activeProfileId
        : profiles[0].id;

      return {
        enabled: value.enabled,
        activeProfileId,
        profiles
      };
    }
  }

  return DEFAULT_STATE;
}

function buildRules(state) {
  const profile = state.profiles.find((item) => item.id === state.activeProfileId);
  if (!profile) return [];

  const requestHeaders = toHeaderOperations(profile.requestHeaders);
  const responseHeaders = toHeaderOperations(profile.responseHeaders);
  if (!requestHeaders.length && !responseHeaders.length) return [];

  const action = { type: "modifyHeaders" };
  if (requestHeaders.length) action.requestHeaders = requestHeaders;
  if (responseHeaders.length) action.responseHeaders = responseHeaders;

  return [
    {
      id: 1,
      priority: 1,
      action,
      condition: {
        urlFilter: normaliseUrlFilter(profile.urlFilter),
        resourceTypes: [
          "main_frame",
          "sub_frame",
          "stylesheet",
          "script",
          "image",
          "font",
          "object",
          "xmlhttprequest",
          "ping",
          "csp_report",
          "media",
          "websocket",
          "webtransport",
          "webbundle",
          "other"
        ]
      }
    }
  ];
}

function toHeaderOperations(headers = []) {
  return headers
    .filter((header) => header.enabled !== false && header.name?.trim())
    .map((header) => {
      const operation = header.operation === "remove" ? "remove" : "set";
      const result = {
        header: header.name.trim(),
        operation
      };

      if (operation === "set") result.value = header.value ?? "";
      return result;
    });
}

function normaliseUrlFilter(value) {
  const trimmed = value?.trim();
  return !trimmed || trimmed === "*" ? "|http" : trimmed;
}

async function updateBadge(state, ruleCount) {
  const active = state.enabled && ruleCount > 0;
  await chrome.action.setBadgeText({ text: active ? "ON" : "" });
  await chrome.action.setBadgeBackgroundColor({ color: active ? "#2563eb" : "#64748b" });
}
