const STORAGE_KEY = "headerForgeState"; // allow-secret
const DEFAULT_STATE = {
  enabled: true,
  activeProfileId: "default",
  profiles: [{ id: "default", name: "Default", urlFilter: "*", requestHeaders: [], responseHeaders: [] }]
};

let state;
let saveTimer;

const elements = {
  shell: document.querySelector(".app-shell"),
  enabled: document.querySelector("#global-enabled"),
  globalStatus: document.querySelector("#global-status"),
  activeRuleCount: document.querySelector("#active-rule-count"),
  activeUrlFilter: document.querySelector("#active-url-filter"),
  profileSelect: document.querySelector("#profile-select"),
  deleteProfile: document.querySelector("#delete-profile"),
  urlFilter: document.querySelector("#url-filter"),
  requestHeaders: document.querySelector("#request-headers"),
  responseHeaders: document.querySelector("#response-headers"),
  requestCount: document.querySelector("#request-count"),
  responseCount: document.querySelector("#response-count"),
  status: document.querySelector("#status"),
  template: document.querySelector("#header-row-template"),
  version: document.querySelector("#version")
};

init().catch(showError);

async function init() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  state = validateState(stored[STORAGE_KEY]) ? stored[STORAGE_KEY] : structuredClone(DEFAULT_STATE);
  elements.version.textContent = `v${chrome.runtime.getManifest().version}`;
  bindEvents();
  render();
}

function bindEvents() {
  elements.enabled.addEventListener("change", () => {
    state.enabled = elements.enabled.checked;
    renderSummary();
    queueSave();
  });

  elements.profileSelect.addEventListener("change", () => {
    state.activeProfileId = elements.profileSelect.value;
    render();
    queueSave();
  });

  elements.urlFilter.addEventListener("input", () => {
    activeProfile().urlFilter = elements.urlFilter.value;
    renderSummary();
    queueSave();
  });

  document.querySelectorAll("[data-add]").forEach((button) => {
    button.addEventListener("click", () => {
      activeProfile()[button.dataset.add].push({ enabled: true, operation: "set", name: "", value: "" });
      renderHeaderRows(button.dataset.add);
      queueSave();
    });
  });

  document.querySelector("#add-profile").addEventListener("click", addProfile);
  document.querySelector("#rename-profile").addEventListener("click", renameProfile);
  document.querySelector("#delete-profile").addEventListener("click", deleteProfile);
  document.querySelector("#export").addEventListener("click", exportState);
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
    operation.value = header.operation === "remove" ? "remove" : "set";
    name.value = header.name ?? "";
    value.value = header.value ?? "";
    row.classList.toggle("is-remove", operation.value === "remove");
    row.classList.toggle("is-disabled", !enabled.checked);
    value.disabled = operation.value === "remove";

    enabled.addEventListener("change", () => {
      updateHeader(key, index, "enabled", enabled.checked);
      row.classList.toggle("is-disabled", !enabled.checked);
      renderRuleCount(key, headers);
      renderSummary();
    });
    operation.addEventListener("change", () => {
      updateHeader(key, index, "operation", operation.value);
      row.classList.toggle("is-remove", operation.value === "remove");
      value.disabled = operation.value === "remove";
    });
    name.addEventListener("input", () => updateHeader(key, index, "name", name.value));
    value.addEventListener("input", () => updateHeader(key, index, "value", value.value));
    row.querySelector(".row-delete").addEventListener("click", () => {
      headers.splice(index, 1);
      renderHeaderRows(key);
      queueSave();
    });

    container.append(row);
  });

  renderSummary();
}

function renderRuleCount(key, headers) {
  const count = key === "requestHeaders" ? elements.requestCount : elements.responseCount;
  count.hidden = headers.length === 0;
  count.textContent = `${countActiveHeaders(headers)}/${headers.length}`;
}

function renderSummary() {
  const profile = activeProfile();
  const configuredRuleCount = countActiveHeaders(profile.requestHeaders) + countActiveHeaders(profile.responseHeaders);
  const activeRuleCount = state.enabled ? configuredRuleCount : 0;
  const noun = activeRuleCount === 1 ? "rule" : "rules";

  elements.activeRuleCount.textContent = `${activeRuleCount} ${noun} active`;
  elements.activeUrlFilter.textContent = profile.urlFilter?.trim() || "*";
  elements.globalStatus.textContent = state.enabled ? "ACTIVE" : "PAUSED";
  elements.shell.classList.toggle("is-live", activeRuleCount > 0);
}

function countActiveHeaders(headers) {
  return headers.filter((header) => header.enabled !== false && header.name?.trim()).length;
}

function updateHeader(key, index, field, value) {
  activeProfile()[key][index][field] = value;
  if (field === "name") {
    renderRuleCount(key, activeProfile()[key]);
    renderSummary();
  }
  queueSave();
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
  queueSave();
}

function renameProfile() {
  const profile = activeProfile();
  const name = prompt("Profile name", profile.name)?.trim();
  if (!name) return;
  profile.name = name;
  render();
  queueSave();
}

function deleteProfile() {
  if (state.profiles.length === 1) return showStatus("Keep at least one profile");
  if (!confirm(`Delete profile “${activeProfile().name}”?`)) return;
  state.profiles = state.profiles.filter((profile) => profile.id !== state.activeProfileId);
  state.activeProfileId = state.profiles[0].id;
  render();
  queueSave();
}

function queueSave() {
  clearTimeout(saveTimer);
  showStatus("Saving…");
  saveTimer = setTimeout(() => save().catch(showError), 250);
}

async function save() {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
  const result = await chrome.runtime.sendMessage({ type: "REBUILD_RULES" });
  if (!result?.ok) throw new Error(result?.error || "Could not rebuild rules");
  showStatus("Saved");
}

function exportState() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "header-forge.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

async function importState(event) {
  const [file] = event.target.files;
  event.target.value = "";
  if (!file) return;

  try {
    const imported = JSON.parse(await file.text());
    if (!validateState(imported)) throw new Error("Invalid settings file");
    state = imported;
    render();
    await save();
  } catch (error) {
    showError(error);
  }
}

function validateState(value) {
  return Boolean(
    value &&
    typeof value.enabled === "boolean" &&
    typeof value.activeProfileId === "string" &&
    Array.isArray(value.profiles) &&
    value.profiles.length &&
    value.profiles.every((profile) =>
      typeof profile.id === "string" &&
      typeof profile.name === "string" &&
      Array.isArray(profile.requestHeaders) &&
      Array.isArray(profile.responseHeaders)
    )
  );
}

function showStatus(message) {
  elements.status.textContent = message;
  setTimeout(() => {
    if (elements.status.textContent === message) elements.status.textContent = "";
  }, 1800);
}

function showError(error) {
  console.error(error);
  showStatus(`Error: ${error.message}`);
}
