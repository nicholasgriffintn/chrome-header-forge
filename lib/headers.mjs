export function isSensitiveHeaderName(value) {
  const name = String(value || "").trim();
  return /^(?:authorization|cookie|set-cookie|proxy-authorization)$/i.test(name)
    || /(?:^|[-_])(?:api[-_]?key|access[-_]?token|auth[-_]?token|client[-_]?secret|session[-_]?token|refresh[-_]?token|id[-_]?token|csrf[-_]?token|credentials?|secret)(?:$|[-_])/i.test(name);
}
