const APPENDABLE_REQUEST_HEADERS = new Set([
  "accept",
  "accept-encoding",
  "accept-language",
  "access-control-request-headers",
  "cache-control",
  "connection",
  "content-language",
  "cookie",
  "forwarded",
  "if-match",
  "if-none-match",
  "keep-alive",
  "range",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "user-agent",
  "via",
  "want-digest",
  "x-forwarded-for"
]);

const HEADER_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const RESOURCE_TYPES = [
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
];

export function buildRules(state) {
  const profile = state.profiles.find((item) => item.id === state.activeProfileId);
  if (!profile || getUrlFilterError(profile.urlFilter)) return [];

  const requestHeaders = toHeaderOperations(profile.requestHeaders, "requestHeaders");
  const responseHeaders = toHeaderOperations(profile.responseHeaders, "responseHeaders");
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
        resourceTypes: RESOURCE_TYPES
      }
    }
  ];
}

export function countApplicableHeaders(headers, key) {
  return headers.filter((header) =>
    header.enabled !== false &&
    header.name?.trim() &&
    !getHeaderError(header, key)
  ).length;
}

export function getHeaderError(header, key) {
  const name = header?.name?.trim();
  if (!name) return "";
  if (!HEADER_NAME_PATTERN.test(name)) return "Use a valid HTTP header name";
  if (header.operation !== "remove" && /[\0\r\n]/.test(header.value ?? "")) {
    return "Header values cannot contain line breaks";
  }
  if (
    header.operation === "append" &&
    key === "requestHeaders" &&
    !APPENDABLE_REQUEST_HEADERS.has(name.toLowerCase())
  ) {
    return "Chrome cannot append to this request header";
  }
  return "";
}

export function getStateConfigurationError(state) {
  for (const profile of state.profiles) {
    const filterError = getUrlFilterError(profile.urlFilter);
    if (filterError) return `Profile “${profile.name}”: ${filterError}`;

    for (const key of ["requestHeaders", "responseHeaders"]) {
      for (const header of profile[key]) {
        if (header.enabled === false) continue;
        const headerError = getHeaderError(header, key);
        if (headerError) return `Profile “${profile.name}”, header “${header.name}”: ${headerError}`;
      }
    }
  }
  return "";
}

export function getUrlFilterError(value) {
  const filter = value?.trim();
  if (!filter || filter === "*") return "";
  if (/[^\x20-\x7E]/.test(filter)) return "URL filters must use printable ASCII characters";
  if (filter.startsWith("||*")) return "Use * instead of a ||* URL filter";

  const pattern = filter
    .replace(/^\|\|?/, "")
    .replace(/\|$/, "");
  if (!pattern) return "URL filter needs a pattern";
  if (pattern.includes("|")) return "URL filter anchors can only appear at the beginning or end";
  return "";
}

export function normaliseUrlFilter(value) {
  const trimmed = value?.trim();
  return !trimmed || trimmed === "*" ? "|http" : trimmed;
}

function toHeaderOperations(headers = [], key) {
  return headers.flatMap((header) => {
    if (header.enabled === false || !header.name?.trim() || getHeaderError(header, key)) return [];

    const operation = ["append", "remove"].includes(header.operation) ? header.operation : "set";
    const result = {
      header: operation === "append" && key === "requestHeaders"
        ? header.name.trim().toLowerCase()
        : header.name.trim(),
      operation
    };

    if (operation !== "remove") result.value = header.value ?? "";
    return [result];
  });
}
