// IOC type detection and normalization utilities

export type IocType = "ipv4" | "domain" | "url" | "md5" | "sha1" | "sha256";

// Defanging patterns to strip
function defang(value: string): string {
  return value
    .replace(/hxxps?/gi, (m) => m.replace(/xx/i, "tt"))
    .replace(/\[\.\]/g, ".")
    .replace(/\[:\]/g, ":")
    .replace(/\[\/\/\]/g, "//");
}

// Canonical form for dedup comparison
export function normalize(raw: string): string {
  let v = raw.trim();
  v = defang(v);

  // Remove trailing dot (FQDN), trailing slashes, and strip URL fragment
  try {
    // Attempt URL parse – catches full URLs
    const url = new URL(v);
    url.hash = "";
    let out = url.toString();
    // Remove trailing slash only from path if path is just "/"
    if (url.pathname === "/") out = out.replace(/\/$/, "");
    return out.toLowerCase();
  } catch {
    // Not a URL – plain domain / IP / hash
    v = v.replace(/\/+$/, "").replace(/\.+$/, "");
    return v.toLowerCase();
  }
}

// ---- type detection (run on normalized value) ----

const RE = {
  ipv4: /^(\d{1,3}\.){3}\d{1,3}$/,
  md5: /^[0-9a-f]{32}$/i,
  sha1: /^[0-9a-f]{40}$/i,
  sha256: /^[0-9a-f]{64}$/i,
  // Simple domain: labels separated by dots, no scheme
  domain:
    /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i,
  url: /^https?:\/\/.+/i,
};

function isValidIpv4(v: string): boolean {
  if (!RE.ipv4.test(v)) return false;
  return v.split(".").every((o) => parseInt(o, 10) <= 255);
}

export function detectType(normalized: string): IocType | null {
  if (isValidIpv4(normalized)) return "ipv4";
  if (RE.sha256.test(normalized)) return "sha256";
  if (RE.sha1.test(normalized)) return "sha1";
  if (RE.md5.test(normalized)) return "md5";
  if (RE.url.test(normalized)) return "url";
  if (RE.domain.test(normalized)) return "domain";
  return null;
}
