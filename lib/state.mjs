export const STORAGE_KEY = "headerForgeState"; // allow-secret

const HEADER_KEYS = ["requestHeaders", "responseHeaders"];
const OPERATIONS = new Set(["append", "remove", "set"]);
const SENSITIVE_HEADER_PATTERN = /^(?:authorization|cookie|set-cookie|proxy-authorization|x-api-key|api-key|x-auth-token)$/i;

export function createDefaultState() {
  return {
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
}

export function normaliseState(value) {
  if (!isRecord(value) || !Array.isArray(value.profiles)) return createDefaultState();

  const profileIds = new Set();
  const profiles = value.profiles.flatMap((profile) => {
    if (
      !isRecord(profile) ||
      typeof profile.id !== "string" ||
      !profile.id.trim() ||
      profileIds.has(profile.id) ||
      typeof profile.name !== "string" ||
      !profile.name.trim()
    ) {
      return [];
    }

    profileIds.add(profile.id);
    return [{
      id: profile.id,
      name: profile.name,
      urlFilter: typeof profile.urlFilter === "string" ? profile.urlFilter : "*",
      requestHeaders: normaliseHeaders(profile.requestHeaders),
      responseHeaders: normaliseHeaders(profile.responseHeaders)
    }];
  });

  if (!profiles.length) return createDefaultState();

  return {
    enabled: typeof value.enabled === "boolean" ? value.enabled : true,
    activeProfileId: profileIds.has(value.activeProfileId) ? value.activeProfileId : profiles[0].id,
    profiles
  };
}

export function getStateError(value) {
  if (!isRecord(value)) return "Settings must be a JSON object";
  if (typeof value.enabled !== "boolean") return "Settings must include an enabled flag";
  if (typeof value.activeProfileId !== "string" || !value.activeProfileId.trim()) {
    return "Settings must identify an active profile";
  }
  if (!Array.isArray(value.profiles) || !value.profiles.length) {
    return "Settings must contain at least one profile";
  }

  const profileIds = new Set();
  for (const profile of value.profiles) {
    if (!isRecord(profile)) return "Every profile must be an object";
    if (typeof profile.id !== "string" || !profile.id.trim()) return "Every profile needs an ID";
    if (profileIds.has(profile.id)) return "Profile IDs must be unique";
    if (typeof profile.name !== "string" || !profile.name.trim()) return "Every profile needs a name";
    if (typeof profile.urlFilter !== "string") return `Profile “${profile.name}” needs a URL filter`;

    profileIds.add(profile.id);
    for (const key of HEADER_KEYS) {
      if (!Array.isArray(profile[key])) return `Profile “${profile.name}” has invalid header rules`;
      for (const header of profile[key]) {
        if (!isRecord(header)) return `Profile “${profile.name}” has an invalid header rule`;
        if (typeof header.enabled !== "boolean") return "Every header rule needs an enabled flag";
        if (!OPERATIONS.has(header.operation)) return "Every header rule needs a valid operation";
        if (typeof header.name !== "string" || typeof header.value !== "string") {
          return "Every header rule needs text name and value fields";
        }
      }
    }
  }

  if (!profileIds.has(value.activeProfileId)) return "The active profile does not exist";
  return "";
}

export function validateState(value) {
  return !getStateError(value);
}

export function redactStateForExport(value) {
  const state = structuredClone(value);
  for (const profile of state.profiles ?? []) {
    for (const key of HEADER_KEYS) {
      for (const header of profile[key] ?? []) {
        if (
          header.operation !== "remove"
          && SENSITIVE_HEADER_PATTERN.test(header.name?.trim() ?? "")
        ) {
          header.value = "[REDACTED]";
        }
      }
    }
  }
  return state;
}

function normaliseHeaders(value) {
  if (!Array.isArray(value)) return [];

  return value.flatMap((header) => {
    if (!isRecord(header)) return [];

    return [{
      enabled: header.enabled !== false,
      operation: OPERATIONS.has(header.operation) ? header.operation : "set",
      name: typeof header.name === "string" ? header.name : "",
      value: typeof header.value === "string" ? header.value : ""
    }];
  });
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
