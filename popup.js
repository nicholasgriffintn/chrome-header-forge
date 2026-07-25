import {
  countApplicableHeaders,
  getHeaderError,
  getStateConfigurationError,
  getUrlFilterError
} from "./lib/rules.mjs";
import {
  getStateError,
  normaliseState,
  redactStateForExport,
  STORAGE_KEY,
  validateState
} from "./lib/state.mjs";

const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

let state;
let appliedState;
let currentTabUrl = "";
let hasDraftChanges = false;
let saveRevision = 0;

const elements = {
  shell: document.querySelector(".app-shell"),
  enabled: document.querySelector("#global-enabled"),
  globalStatus: document.querySelector("#global-status"),
  activeRuleCount: document.querySelector("#active-rule-count"),
  activeUrlFilter: document.querySelector("#active-url-filter"),
  profileSelect: document.querySelector("#profile-select"),
  deleteProfile: document.querySelector("#delete-profile"),
  urlFilter: document.querySelector("#url-filter"),
  useCurrentSite: document.querySelector("#use-current-site"),
  urlFilterError: document.querySelector("#url-filter-error"),
  requestHeaders: document.querySelector("#request-headers"),
  responseHeaders: document.querySelector("#response-headers"),
  requestCount: document.querySelector("#request-count"),
  responseCount: document.querySelector("#response-count"),
  status: document.querySelector("#status"),
  template: document.querySelector("#header-row-template"),
  version: document.querySelector("#version"),
  apply: document.querySelector("#apply"),
  discard: document.querySelector("#discard")
};

init().catch(showError);

async function init() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  state = normaliseState(stored[STORAGE_KEY]);
  appliedState = structuredClone(state);
  currentTabUrl = await getCurrentTabUrl();
  elements.version.textContent = `v${chrome.runtime.getManifest().version}`;
  bindEvents();
  render();
  if (!validateState(stored[STORAGE_KEY])) await persistState();
}

function bindEvents() {
  elements.enabled.addEventListener("change", () => {
    state.enabled = elements.enabled.checked;
    renderSummary();
    markDraftChanged();
  });

  elements.profileSelect.addEventListener("change", () => {
    state.activeProfileId = elements.profileSelect.value;
    render();
    markDraftChanged();
  });

  elements.urlFilter.addEventListener("input", () => {
    activeProfile().urlFilter = elements.urlFilter.value;
    renderSummary();
    markDraftChanged();
  });

  document.querySelectorAll("[data-add]").forEach((button) => {
    button.addEventListener("click", () => {
      activeProfile()[button.dataset.add].push({ enabled: true, operation: "set", name: "", value: "" });
      renderHeaderRows(button.dataset.add);
      markDraftChanged();
    });
  });

  document.querySelector("#add-profile").addEventListener("click", addProfile);
  document.querySelector("#rename-profile").addEventListener("click", renameProfile);
  document.querySelector("#delete-profile").addEventListener("click", deleteProfile);
  document.querySelector("#export").addEventListener("click", () => exportState(false));
  document.querySelector("#export-sensitive").addEventListener("click", () => exportState(true));
  elements.useCurrentSite.addEventListener("click", useCurrentSite);
  elements.apply.addEventListener("click", applyDraft);
  elements.discard.addEventListener("click", discardDraft);
  document.querySelector("#import").addEventListener("change", importState);
}

function render() {
  elements.enabled.checked = state.enabled;
  elements.deleteProfile.disabled = state.profiles.length === 1;
  elements.profileSelect.replaceChildren(...state.profiles.map((profile) => {
    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent = profile.name;
    option.selected = profile.id === state.activeProfileId;
    return option;
  }));
  elements.urlFilter.value = activeProfile().urlFilter ?? "*";
  elements.useCurrentSite.hidden = !currentTabUrl;
  renderHeaderRows("requestHeaders");
  renderHeaderRows("responseHeaders");
  renderSummary();
}

function renderHeaderRows(key) {
  const container = elements[key];
  const headers = activeProfile()[key];
  container.replaceChildren();
  renderRuleCount(key, headers);

  if (!headers.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    const icon = document.createElement("span");
    const message = document.createElement("span");
    icon.className = "empty-icon";
    icon.setAttribute("aria-hidden", "true");
    message.textContent = "No header rules";
    empty.append(icon, message);
    container.append(empty);
    renderSummary();
    return;
  }

  headers.forEach((header, index) => {
    const row = elements.template.content.firstElementChild.cloneNode(true);
    const enabled = row.querySelector(".row-enabled");
    const operation = row.querySelector(".row-operation");
    const name = row.querySelector(".row-name");
    const value = row.querySelector(".row-value");

    enabled.checked = header.enabled !== false;
    operation.value = ["append", "remove"].includes(header.operation) ? header.operation : "set";
    name.value = header.name ?? "";
    value.value = header.value ?? "";
    row.classList.toggle("is-remove", operation.value === "remove");
    row.classList.toggle("is-disabled", !enabled.checked);
    value.disabled = operation.value === "remove";
    renderHeaderValidation(row, header, key);

    enabled.addEventListener("change", () => {
      updateHeader(key, index, "enabled", enabled.checked, row);
      row.classList.toggle("is-disabled", !enabled.checked);
    });
    operation.addEventListener("change", () => {
      updateHeader(key, index, "operation", operation.value, row);
      row.classList.toggle("is-remove", operation.value === "remove");
      value.disabled = operation.value === "remove";
    });
    name.addEventListener("input", () => updateHeader(key, index, "name", name.value, row));
    value.addEventListener("input", () => updateHeader(key, index, "value", value.value, row));
    row.querySelector(".row-delete").addEventListener("click", () => {
      headers.splice(index, 1);
      renderHeaderRows(key);
      markDraftChanged();
    });

    container.append(row);
  });

  renderSummary();
}

function renderRuleCount(key, headers) {
  const count = key === "requestHeaders" ? elements.requestCount : elements.responseCount;
  count.hidden = headers.length === 0;
  count.textContent = `${countApplicableHeaders(headers, key)}/${headers.length}`;
}

function renderSummary() {
  const draftProfile = activeProfile();
  const appliedProfile = appliedState.profiles.find(
    (profile) => profile.id === appliedState.activeProfileId
  ) ?? appliedState.profiles[0];
  const filterError = getUrlFilterError(draftProfile.urlFilter);
  const configuredRuleCount =
    countApplicableHeaders(appliedProfile.requestHeaders, "requestHeaders") +
    countApplicableHeaders(appliedProfile.responseHeaders, "responseHeaders");
  const appliedFilterError = getUrlFilterError(appliedProfile.urlFilter);
  const activeRuleCount = appliedState.enabled && !appliedFilterError ? configuredRuleCount : 0;
  const noun = activeRuleCount === 1 ? "rule" : "rules";

  elements.activeRuleCount.textContent = `${activeRuleCount} ${noun} active`;
  elements.activeUrlFilter.textContent = appliedProfile.urlFilter?.trim() || "*";
  elements.globalStatus.textContent = hasDraftChanges
    ? "DRAFT"
    : appliedState.enabled && appliedFilterError
      ? "ERROR"
      : appliedState.enabled
        ? "ACTIVE"
        : "PAUSED";
  elements.urlFilterError.textContent = filterError;
  elements.urlFilter.setAttribute("aria-invalid", String(Boolean(filterError)));
  elements.shell.classList.toggle("is-live", activeRuleCount > 0);
  elements.apply.disabled = !hasDraftChanges;
  elements.discard.disabled = !hasDraftChanges;
}

function renderHeaderValidation(row, header, key) {
  const error = getHeaderError(header, key);
  row.classList.toggle("is-invalid", Boolean(error));
  row.querySelector(".row-error").textContent = error;
  row.querySelector(".row-name").setAttribute("aria-invalid", String(Boolean(error)));
  row.querySelector(".row-value").setAttribute("aria-invalid", String(Boolean(error)));
}

function updateHeader(key, index, field, value, row) {
  const headers = activeProfile()[key];
  headers[index][field] = value;
  renderHeaderValidation(row, headers[index], key);
  renderRuleCount(key, headers);
  renderSummary();
  markDraftChanged();
}

function activeProfile() {
  return state.profiles.find((profile) => profile.id === state.activeProfileId) ?? state.profiles[0];
}

function addProfile() {
  const name = prompt("Profile name", "New profile")?.trim();
  if (!name) return;
  const profile = { id: crypto.randomUUID(), name, urlFilter: "*", requestHeaders: [], responseHeaders: [] };
  state.profiles.push(profile);
  state.activeProfileId = profile.id;
  render();
  markDraftChanged();
}

function renameProfile() {
  const profile = activeProfile();
  const name = prompt("Profile name", profile.name)?.trim();
  if (!name) return;
  profile.name = name;
  render();
  markDraftChanged();
}

function deleteProfile() {
  if (state.profiles.length === 1) return showStatus("Keep at least one profile");
  if (!confirm(`Delete profile “${activeProfile().name}”?`)) return;
  state.profiles = state.profiles.filter((profile) => profile.id !== state.activeProfileId);
  state.activeProfileId = state.profiles[0].id;
  render();
  markDraftChanged();
}

function persistState() {
  const revision = ++saveRevision;
  const snapshot = structuredClone(state);
  showStatus("Saving…");
  const request = chrome.storage.local
    .set({ [STORAGE_KEY]: snapshot })
    .then(() => {
      if (revision === saveRevision) showStatus("Saved");
    });

  request.catch((error) => {
    if (revision === saveRevision) showError(error);
  });
  return request;
}

function exportState(includeSensitiveValues) {
  if (
    includeSensitiveValues
    && !confirm("This backup can contain credentials and private header values. Continue?")
  ) return;
  const exportedState = includeSensitiveValues ? state : redactStateForExport(state);
  const blob = new Blob([JSON.stringify(exportedState, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = includeSensitiveValues ? "header-forge-backup.json" : "header-forge-redacted.json";
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function importState(event) {
  const [file] = event.target.files;
  event.target.value = "";
  if (!file) return;

  try {
    if (file.size > MAX_IMPORT_BYTES) throw new Error("Settings file exceeds Chrome's 10 MB storage limit");
    const imported = JSON.parse(await file.text());
    const stateError = getStateError(imported);
    if (stateError) throw new Error(stateError);
    const configurationError = getStateConfigurationError(imported);
    if (configurationError) throw new Error(configurationError);
    if (!confirm("Import these settings and replace all current profiles?")) return;
    state = normaliseState(imported);
    hasDraftChanges = true;
    render();
    await applyDraft();
  } catch (error) {
    showError(error);
  }
}

function markDraftChanged() {
  hasDraftChanges = true;
  renderSummary();
  showStatus("Changes not applied");
}

async function applyDraft() {
  const stateError = getStateError(state);
  const configurationError = getStateConfigurationError(state);
  if (stateError || configurationError) {
    showStatus(`Fix before applying: ${stateError || configurationError}`);
    return;
  }
  await persistState();
  appliedState = structuredClone(state);
  hasDraftChanges = false;
  render();
}

function discardDraft() {
  state = structuredClone(appliedState);
  hasDraftChanges = false;
  render();
  showStatus("Draft discarded");
}

function useCurrentSite() {
  if (!currentTabUrl) return;
  const hostname = new URL(currentTabUrl).hostname;
  activeProfile().urlFilter = `||${hostname}^`;
  elements.urlFilter.value = activeProfile().urlFilter;
  renderSummary();
  markDraftChanged();
}

async function getCurrentTabUrl() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return /^https?:/.test(tab?.url ?? "") ? tab.url : "";
  } catch {
    return "";
  }
}

function showStatus(message) {
  elements.status.textContent = message;
  setTimeout(() => {
    if (elements.status.textContent === message) elements.status.textContent = "";
  }, 1800);
}

function showError(error) {
  console.error(error);
  showStatus(`Error: ${error instanceof Error ? error.message : String(error)}`);
}
